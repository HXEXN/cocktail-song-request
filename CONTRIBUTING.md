# Contributing

Thanks for improving Cocktail Song Request.

## Local Development

```bash
npm install
npm start
```

Run checks before opening a pull request:

```bash
npm run check
npm audit
```

## Pull Request Guidelines

- Keep venue-facing UI readable on projector and mobile widths.
- Avoid committing `data/state.json`; it can contain request history and participant names.
- Prefer small, focused changes with a clear before/after description.
- When changing display UI, check `/display` and `/request` in a browser.
