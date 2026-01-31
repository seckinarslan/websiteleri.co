export function initGlobalErrorCapture() {
  window.addEventListener("unhandledrejection", (e) => {
    console.error("UNHANDLED PROMISE:", e.reason);
    alert(
      "Unhandled promise: " +
        (e.reason?.code || "") +
        " " +
        (e.reason?.message || e.reason)
    );
  });

  window.addEventListener("error", (e) => {
    console.error("WINDOW ERROR:", e.error || e.message);
  });
}
