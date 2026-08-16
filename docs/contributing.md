# 🤝 Contributing Guidelines

Thank you for considering contributing to **Site URL Scraper**! We welcome bug reports, feature suggestions, documentation improvements, and pull requests.

---

## 📜 Code of Conduct

Please treat all contributors and maintainers with respect, empathy, and professionalism.

---

## 🛠 Local Development & Testing

Before opening a pull request, ensure your local changes pass all automated quality checks:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Check Types & Lint**:
   ```bash
   npm run lint
   npm run typecheck
   ```

3. **Verify Production Build**:
   ```bash
   npm run build
   ```

---

## 🔀 Git Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` A new feature for the user
- `fix:` A bug fix
- `docs:` Documentation changes
- `style:` Formatting or UI styling changes without logic impact
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks, dependency updates, or CI configuration

**Example Commit Message**:
```
feat(logger): add copy-to-clipboard button in terminal logger component
```

---

## 🚀 Pull Request Checklist

When submitting a pull request:

- [ ] Branch created from `main` or `develop`.
- [ ] Code passes `npm run lint` without TypeScript or syntax errors.
- [ ] Tested locally with `npm run dev` and `npm run build`.
- [ ] Updated `CHANGELOG.md` under `[Unreleased]` if applicable.
- [ ] Included a clear description of the problem solved and changes introduced.
