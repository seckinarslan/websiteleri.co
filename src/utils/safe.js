export async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[${label}]`, e);
    alert(`${label} hata: ${e.code || ""} ${e.message || e}`);
    throw e;
  }
}