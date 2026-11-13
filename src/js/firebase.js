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
  var sdkFiles = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-analytics-compat.js"];
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
    var provider = new firebase.auth.GoogleAuthProvider();
    window.firebaseApp = app;
    window.firebaseAuth = auth;

    var analyticsReady = firebase.analytics.isSupported()
      .then(function (supported) { return supported ? firebase.analytics.getAnalytics(app) : null; })
      .catch(function (error) { console.warn("Firebase Analytics 初始化失敗：", error); return null; });
    window.firebaseAnalyticsReady = analyticsReady;
    window.trackFirebaseEvent = function (name, params) {
      analyticsReady.then(function (analytics) { if (analytics) firebase.analytics.logEvent(analytics, name, params || {}); });
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
        "auth/operation-not-allowed": "請在 Firebase Console 啟用此登入方式。",
        "auth/network-request-failed": "網路連線失敗，請稍後再試。"
      };
      feedback(messages[error.code] || "登入失敗，請稍後再試。", "error");
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
      auth.signInWithPopup(provider).then(function () { window.trackFirebaseEvent("google_sign_in"); openMenu(false); }).catch(fail).finally(function () { el.google.disabled = false; });
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
    auth.onAuthStateChanged(renderUser, fail);
    window.trackFirebaseEvent("journey_app_open");
  }).catch(showBootError);
})();