# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Emails de pedidos

La app ahora puede enviar emails automáticos cuando:

- se crea un pedido nuevo;
- el admin cambia el estado del pedido.

Flujo implementado:

- el cliente recibe confirmación con el detalle del pedido y la factura en el cuerpo del mail;
- CeliaShop recibe una copia del pedido nuevo en celiashopazul@gmail.com;
- el cliente recibe un mail cada vez que el estado pasa a Pendiente, Confirmado, Enviado o Entregado.

### Activación en Supabase

1. Ejecutá [setup_checkout.sql](setup_checkout.sql) en Supabase SQL Editor para asegurar las columnas email y telefono en pedidos.
2. Creá estas variables en Supabase Edge Functions:
	- RESEND_API_KEY
	- ORDER_EMAIL_FROM
	- ORDER_NOTIFICATION_EMAIL
	- ORDER_ADMIN_EMAILS
3. Recomendado:
	- ORDER_NOTIFICATION_EMAIL=celiashopazul@gmail.com
	- ORDER_ADMIN_EMAILS=giannattasio.nicolas@hotmail.com
4. Desplegá la función:

```bash
supabase functions deploy order-email
```

Notas:

- ORDER_EMAIL_FROM debe ser un remitente válido en Resend.
- la función vive en [supabase/functions/order-email/index.ts](supabase/functions/order-email/index.ts).
- el frontend la invoca desde [src/orderNotifications.js](src/orderNotifications.js).

### Verificación en producción (paso 1)

1. Crear un pedido de prueba desde una cuenta cliente real.
2. Confirmar que llega email al cliente y a celiashopazul@gmail.com.
3. Entrar al panel admin y cambiar estado del mismo pedido a Confirmado, Enviado y Entregado.
4. Confirmar que cada cambio dispara email al cliente.
5. Si no llega email:
	- revisar logs de la función order-email en Supabase;
	- validar variables RESEND_API_KEY y ORDER_EMAIL_FROM;
	- validar ORDER_ADMIN_EMAILS con el email admin real.

### Backup de deploy inmediato (paso 2)

El repositorio quedó preparado para correr desde dos fuentes de Pages:

- principal: main /docs;
- backup: main /(root).

Si vuelve a fallar /docs, podés cambiar en GitHub Settings > Pages:

1. Source: Deploy from a branch.
2. Branch: main.
3. Folder: /(root).
4. Save.

Con eso la web usa [index.html](index.html) y sigue cargando desde /celiacos/assets/main.js.
