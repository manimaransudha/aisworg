---
name: error-handling
description: How a route handler reports a failure in this repo — the three catch-block patterns (web page error via next(err), web user-facing error via redirects, API error via res.status().json). Use whenever the user asks to write, review or change the catch block or error response of a route handler under src/routes.
---

# Error handling in route handlers

Every handler wraps its work in `try/catch`. The catch block follows exactly one of the three patterns below, chosen by the kind of route.

## 1. Web page route (GET that renders a view): `next(err)`

The catch block logs the error and passes it to the central `errorHandler` (`src/middleware/errorHandler.ts`, registered in `src/app.ts`).

```ts
} catch (err) {
  logger.error("[web/seu/seus] GET /seus error", err as Error);
  next(err);
}
```

- The handler declares `next` in its signature.
- `errorHandler` redirects a CSRF failure to login. For every other error it responds with `err.statusCode || 500` and a JSON body.
- The handler does not build its own error response.

## 2. Web form or action route: `redirects.<area>.error`

The catch block redirects back to the page the user came from with the message the user sees.

```ts
} catch (err) {
  redirects.<area>.error(req, res, (err as Error).message);
}
```

- The message reaches the user through the `redirects` entry in `redirects.ts`.
- The handler never calls `flashError` or `flashSuccess` and never assigns `req.session.flash`.
- The `redirects` entry for the path exists before the route is used.

## 3. API route (`src/routes/seu/api/`): `res.status(400).json`

The catch block logs the error and responds with status 400 and the message.

```ts
} catch (err) {
  logger.error("[api/seu/decisions] POST error", err as Error);
  res.status(400).json({ error: (err as Error).message });
}
```

- The body shape is `{ error: "<message>" }`.
- A validation failure inside the `try` responds with `return res.status(<code>).json({ error: "<message>" })` before the catch is reached.
- A transition rejection responds with `res.status(409).json({ reason, detail })`.

## Choosing

| Route | Pattern |
|---|---|
| Renders a view | 1 |
| Handles a form post or action and returns to a page | 2 |
| Lives under `src/routes/seu/api/` | 3 |
