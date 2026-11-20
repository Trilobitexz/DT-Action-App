(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyCE0lWfxqFyylI7z13IUrW6Jv9PMEGCiMI",
    authDomain: "dt-action-app.firebaseapp.com",
    projectId: "dt-action-app",
    storageBucket: "dt-action-app.firebasestorage.app",
    messagingSenderId: "1023681330470",
    appId: "1:1023681330470:web:58495acf12a95c354f55e7",
    measurementId: "G-WZXKJB3ZLR"
  };

  var sdkUrl = "https://www.gstatic.com/firebasejs/11.0.2/";
  var sdkFiles = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js", "firebase-analytics-compat.js"];
  var sdkReady = new Promise(function (resolve, reject) {
    var index = 0;
    function loadNext() {
      if (index >= sdkFiles.length) return resolve();
      var url = sdkUrl + sdkFiles[index++];
      var script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = loadNext;
      script.onerror = function () { reject(new Error("Firebase SDK 載入失敗：" + url)); };
      document.head.appendChild(script);
    }
    loadNext();
  });

  function showBootError(error) {
    console.error("Firebase 初始化失敗：", error);
    var status = document.getElementById("google-user-status");
    if (status) status.textContent = "登入服務載入失敗，請確認網路連線後重新整理。";
    var trigger = document.getElementById("auth-menu-trigger");
    if (trigger) trigger.disabled = true;
  }

  sdkReady.then(function () {
    var firebase = window.firebase;
    var app = firebase.initializeApp(firebaseConfig);
    var auth = firebase.auth();
    var db = firebase.firestore();
    var provider = new firebase.auth.GoogleAuthProvider();
    window.firebaseApp = app;
    window.firebaseAuth = auth;
    window.firebaseFirestore = db;

    var analyticsReady = firebase.analytics.isSupported()
      .then(function (supported) { return supported ? firebase.analytics(app) : null; })
      .catch(function (error) { console.warn("Firebase Analytics 初始化失敗：", error); return null; });
    window.firebaseAnalyticsReady = analyticsReady;
    window.trackFirebaseEvent = function (name, params) {
      analyticsReady.then(function (analytics) {
        if (!analytics) return;
        try {
          analytics.logEvent(name, params || {});
        } catch (error) {
          console.warn("Firebase Analytics 事件記錄失敗：", error);
        }
      });
    };

    var cloudSyncReadyUid = null;
    var cloudSyncGeneration = 0;
    var cloudWriteTimers = new Map();
    var cloudOwnerStorageKey = "journey-atlas-cloud-owner";
    var cloudMetaStoragePrefix = "journey-atlas-cloud-meta-";
    var managedStoragePrefix = "journey-atlas-";

    function isCloudDataKey(key) {
      return typeof key === "string" && /^journey-atlas-(compare|favorites|recent|itineraries|budget-[A-Za-z0-9_-]{1,120})$/.test(key);
    }

    function storageKeyForDataId(dataId) {
      return managedStoragePrefix + dataId;
    }

    function firestoreDataRef(uid, key) {
      return db.collection("users").doc(uid).collection("appData").doc(key.slice(managedStoragePrefix.length));
    }

    function readCloudMeta(uid) {
      try { return JSON.parse(localStorage.getItem(cloudMetaStoragePrefix + uid) || "{}"); }
      catch (error) { console.warn("無法讀取雲端同步記錄。", error); return {}; }
    }

    function writeCloudMeta(uid, meta) {
      try { localStorage.setItem(cloudMetaStoragePrefix + uid, JSON.stringify(meta)); }
      catch (error) { console.warn("無法保存雲端同步記錄。", error); }
    }

    function setCloudSyncStatus(message, state) {
      var status = document.getElementById("cloud-sync-status");
      if (!status) return;
      status.textContent = message;
      if (state) status.dataset.state = state;
      else delete status.dataset.state;
    }

    function writeCloudValue(uid, key, value) {
      if (!isCloudDataKey(key) || typeof value !== "string" || value.length > 700000) return Promise.resolve();
      return firestoreDataRef(uid, key).set({ value: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    function uploadLocalValue(uid, key) {
      var value = localStorage.getItem(key);
      if (value === null) return Promise.resolve();
      return writeCloudValue(uid, key, value);
    }

    function clearCloudManagedLocalData() {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (isCloudDataKey(key)) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    }

    async function syncUserData(user) {
      var uid = user.uid;
      var runId = ++cloudSyncGeneration;
      cloudSyncReadyUid = null;
      setCloudSyncStatus("正在同步個人資料…", "pending");
      var previousOwner = localStorage.getItem(cloudOwnerStorageKey);
      var isFirstAccountSync = !previousOwner;
      if (previousOwner && previousOwner !== uid) clearCloudManagedLocalData();

      var collectionRef = db.collection("users").doc(uid).collection("appData");
      var snapshot = await collectionRef.get();
      if (runId !== cloudSyncGeneration || !auth.currentUser || auth.currentUser.uid !== uid) return;
      var remoteByKey = new Map();
      snapshot.forEach(function (doc) {
        var key = storageKeyForDataId(doc.id);
        if (isCloudDataKey(key) && typeof doc.data().value === "string") remoteByKey.set(key, doc);
      });

      var meta = readCloudMeta(uid);
      var uploads = [];
      remoteByKey.forEach(function (doc, key) {
        var localValue = localStorage.getItem(key);
        var localEdit = meta[key];
        var remoteTime = doc.data().updatedAt && typeof doc.data().updatedAt.toMillis === "function" ? doc.data().updatedAt.toMillis() : 0;
        if (localEdit && localEdit.updatedAt > remoteTime) {
          if (localEdit.deleted) uploads.push(firestoreDataRef(uid, key).delete());
          else if (localValue !== null) uploads.push(writeCloudValue(uid, key, localValue));
          delete meta[key];
          return;
        }
        localStorage.setItem(key, doc.data().value);
        delete meta[key];
      });

      var localKeys = [];
      for (var j = 0; j < localStorage.length; j++) {
        var localKey = localStorage.key(j);
        if (isCloudDataKey(localKey)) localKeys.push(localKey);
      }
      localKeys.forEach(function (key) {
        if (remoteByKey.has(key)) return;
        var localEdit = meta[key];
        if (localEdit && localEdit.deleted) { delete meta[key]; return; }
        if (isFirstAccountSync || localEdit) uploads.push(uploadLocalValue(uid, key));
        if (localEdit) delete meta[key];
      });

      await Promise.all(uploads);
      if (runId === cloudSyncGeneration && auth.currentUser && auth.currentUser.uid === uid) {
        localStorage.setItem(cloudOwnerStorageKey, uid);
        writeCloudMeta(uid, meta);
        cloudSyncReadyUid = uid;
        setCloudSyncStatus("資料已同步至個人雲端資料庫", "success");
        window.PlannerView?.refreshCloudData?.();
      }
    }

    window.FirebaseCloudData = {
      saveLocal: function (key, value) {
        if (!isCloudDataKey(key)) return;
        var user = auth.currentUser;
        if (!user) return;
        var uid = user.uid;
        var meta = readCloudMeta(uid);
        meta[key] = { updatedAt: Date.now(), deleted: false };
        writeCloudMeta(uid, meta);
        if (cloudSyncReadyUid !== uid) return;
        window.clearTimeout(cloudWriteTimers.get(key));
        cloudWriteTimers.set(key, window.setTimeout(function () {
          uploadLocalValue(uid, key).then(function () {
            if (auth.currentUser?.uid === uid) setCloudSyncStatus("資料已同步至個人雲端資料庫", "success");
          }).catch(function (error) {
            console.error("Firestore 資料寫入失敗：", error);
            setCloudSyncStatus("雲端同步失敗，資料仍保存在本機。請檢查資料庫規則與網路。", "error");
          });
        }, 450));
      },
      removeLocal: function (key) {
        if (!isCloudDataKey(key)) return;
        var user = auth.currentUser;
        if (!user) return;
        var uid = user.uid;
        var meta = readCloudMeta(uid);
        meta[key] = { updatedAt: Date.now(), deleted: true };
        writeCloudMeta(uid, meta);
        if (cloudSyncReadyUid !== uid) return;
        window.clearTimeout(cloudWriteTimers.get(key));
        cloudWriteTimers.delete(key);
        firestoreDataRef(uid, key).delete().then(function () {
          var nextMeta = readCloudMeta(uid); delete nextMeta[key]; writeCloudMeta(uid, nextMeta);
        }).catch(function (error) {
          console.error("Firestore 資料刪除失敗：", error);
          setCloudSyncStatus("雲端刪除失敗，請檢查網路後再試。", "error");
        });
      }
    };
    var el = {
      menu: document.getElementById("auth-menu"),
      trigger: document.getElementById("auth-menu-trigger"),
      panel: document.getElementById("auth-menu-panel"),
      label: document.getElementById("auth-menu-label"),
      avatar: document.getElementById("auth-avatar"),
      status: document.getElementById("google-user-status"),
      google: document.getElementById("btn-google-sign-in"),
      signOut: document.getElementById("btn-google-sign-out"),
      form: document.getElementById("email-auth-form"),
      email: document.getElementById("auth-email"),
      password: document.getElementById("auth-password"),
      emailSignIn: document.getElementById("btn-email-sign-in"),
      register: document.getElementById("btn-email-register"),
      resend: document.getElementById("btn-resend-verification"),
      feedback: document.getElementById("auth-feedback")
    };

    function feedback(message, kind) {
      el.feedback.textContent = message || "";
      if (kind) el.feedback.dataset.state = kind;
      else delete el.feedback.dataset.state;
    }
    function fail(error) {
      console.error("Firebase Authentication 錯誤：", error);
      if (error.code === "auth/popup-closed-by-user") return feedback("登入視窗已關閉。", "error");
      var messages = {
        "auth/invalid-email": "請輸入有效的電子郵件地址。",
        "auth/weak-password": "密碼至少需要 6 個字元。",
        "auth/email-already-in-use": "此電子郵件已註冊，請直接登入。",
        "auth/invalid-credential": "電子郵件或密碼不正確。",
        "auth/popup-blocked": "登入視窗遭封鎖，請允許彈出視窗。",
        "auth/unauthorized-domain": "此網域尚未加入 Firebase 授權網域。",
        "auth/operation-not-supported-in-this-environment": "目前預覽環境不支援 Google 登入，請使用 HTTPS 網站開啟。",
        "auth/operation-not-allowed": "Firebase 尚未啟用此登入方式，請檢查 Authentication 的 Google 提供者設定。",
        "auth/network-request-failed": "網路連線失敗，請稍後再試。",
        "permission-denied": "雲端資料權限未設定完成，請稍後再試。"
      };
      feedback(messages[error.code] || "登入失敗，請稍後再試。", "error");
    }
    function shouldUseRedirect(error) {
      return ["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/internal-error", "auth/web-storage-unsupported"].indexOf(error?.code) >= 0;
    }
    function signInWithGoogleRedirect() {
      feedback("正在切換至 Google 登入頁面…", "success");
      return auth.signInWithRedirect(provider).catch(fail);
    }
    function openMenu(open) {
      el.panel.hidden = !open;
      el.trigger.setAttribute("aria-expanded", String(open));
    }
    function renderUser(user) {
      var signedIn = !!user;
      var needsVerification = signedIn && user.providerData.some(function (item) { return item.providerId === "password"; }) && !user.emailVerified;
      el.label.textContent = signedIn ? "我的帳戶" : "登入 / 註冊";
      el.status.textContent = !signedIn ? "登入即可使用個人帳戶" : needsVerification ? "請先驗證：" + user.email : "已登入：" + (user.displayName || user.email || "使用者");
      el.status.title = signedIn && user.email ? user.email : "";
      el.google.hidden = signedIn;
      el.form.hidden = signedIn;
      el.signOut.hidden = !signedIn || needsVerification;
      el.resend.hidden = !needsVerification;
      el.avatar.replaceChildren();
      if (signedIn && user.photoURL) {
        var image = document.createElement("img"); image.src = user.photoURL; image.alt = ""; el.avatar.appendChild(image);
      } else el.avatar.textContent = signedIn ? (user.displayName || user.email || "U").trim().charAt(0).toUpperCase() : "👤";
    }
    el.trigger.addEventListener("click", function () { openMenu(el.panel.hidden); });
    document.addEventListener("click", function (event) { if (!el.menu.contains(event.target)) openMenu(false); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !el.panel.hidden) { openMenu(false); el.trigger.focus(); } });
    el.google.addEventListener("click", function () {
      el.google.disabled = true; feedback("");
      var popupTimeout = new Promise(function (_, reject) {
        window.setTimeout(function () {
          var timeout = new Error("Google 登入視窗逾時");
          timeout.code = "auth/popup-timeout";
          reject(timeout);
        }, 10000);
      });
      Promise.race([auth.signInWithPopup(provider), popupTimeout])
        .then(function () { window.trackFirebaseEvent("google_sign_in"); openMenu(false); })
        .catch(function (error) {
          if (shouldUseRedirect(error) || error.code === "auth/popup-timeout") return signInWithGoogleRedirect();
          fail(error);
        })
        .finally(function () { el.google.disabled = false; });
    });
    el.form.addEventListener("submit", function (event) {
      event.preventDefault(); if (!el.form.reportValidity()) return;
      el.emailSignIn.disabled = el.register.disabled = true;
      auth.signInWithEmailAndPassword(el.email.value.trim(), el.password.value).then(function (credential) {
        window.trackFirebaseEvent("email_sign_in");
        if (!credential.user.emailVerified) { feedback("請先至信箱完成驗證，再重新登入。", "error"); return auth.signOut(); }
        feedback("登入成功。", "success"); openMenu(false);
      }).catch(fail).finally(function () { el.emailSignIn.disabled = el.register.disabled = false; });
    });
    el.register.addEventListener("click", function () {
      if (!el.form.reportValidity()) return;
      el.emailSignIn.disabled = el.register.disabled = true;
      auth.createUserWithEmailAndPassword(el.email.value.trim(), el.password.value).then(function (credential) {
        return credential.user.sendEmailVerification().then(function () {
          window.trackFirebaseEvent("email_sign_up"); feedback("驗證信已寄出。請到信箱點擊驗證連結，驗證後再登入。", "success"); return auth.signOut();
        });
      }).then(function () { el.password.value = ""; }).catch(fail).finally(function () { el.emailSignIn.disabled = el.register.disabled = false; });
    });
    el.resend.addEventListener("click", function () {
      if (!auth.currentUser) return;
      el.resend.disabled = true;
      auth.currentUser.sendEmailVerification().then(function () { feedback("驗證信已重新寄出，請檢查信箱。", "success"); }).catch(fail).finally(function () { el.resend.disabled = false; });
    });
    el.signOut.addEventListener("click", function () {
      el.signOut.disabled = true;
      auth.signOut().then(function () { window.trackFirebaseEvent("sign_out"); feedback(""); }).catch(fail).finally(function () { el.signOut.disabled = false; });
    });
    auth.getRedirectResult().catch(function (error) {
      if (error?.code && error.code !== "auth/no-auth-event") fail(error);
    });
    auth.onAuthStateChanged(function (user) {
      renderUser(user);
      if (user) syncUserData(user).catch(function (error) {
        console.error("Firestore 雲端同步失敗：", error);
        setCloudSyncStatus("雲端資料庫尚未就緒或規則尚未發布；資料仍會保存在本機。", "error");
      });
      else { cloudSyncGeneration++; cloudSyncReadyUid = null; setCloudSyncStatus("登入後可將收藏、比較、預算與行程同步到雲端。", ""); }
    }, fail);
    window.trackFirebaseEvent("journey_app_open");
  }).catch(showBootError);
})();

