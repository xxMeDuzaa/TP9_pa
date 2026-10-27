/**
 * Configuración web de tu proyecto Firebase.
 * Consola de Firebase → ⚙ Configuración del proyecto → General → Tus apps → App web → SDK setup and configuration
 *
 * Estos valores NO son secretos: viajan en el bundle de JavaScript y cualquiera puede verlos.
 * La seguridad no depende de esconderlos, sino de Auth + las reglas @auth de SQL Connect
 * (y, más adelante, App Check).
 *
 * Mientras desarrollás con `npm run dev`, la app usa los emuladores locales y no importa
 * si estos valores son reales. Para producción tenés que completarlos.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyA9hJW3AbF3Xcn92Y-c5uZdBNdl6XHTSRE",
  authDomain: "practica-ci-cd.firebaseapp.com",
  projectId: "practica-ci-cd",
  appId: "1:1021385490021:web:655830f8ac825c9fc2508c",
};

/** Debe coincidir con dataconnect/dataconnect.yaml y dataconnect/cursos/connector.yaml */
export const sqlConnectConfig = {
  location: "us-east4",
  service: "catalogo",
  connector: "cursos",
};
