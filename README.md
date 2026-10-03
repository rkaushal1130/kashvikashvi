# KASHVIMLM — Frontend E-Commerce Application

A clean, modern, and fully responsive e-commerce frontend skeleton built with **React** and **Vite**, styled with **Ocean Blue** (`#0284c7`) and **Soft Pink** (`#ec4899`) brand accents on clean white/light surfaces.

## 🚀 Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/) (`react-router-dom`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Consolidated CSS Custom Properties in `index.css`

---

## 📁 Project Structure

```text
src/
├── components/
│   ├── Navbar.jsx          # Sticky frosted-glass navbar with active indicators & mobile drawer
│   ├── Footer.jsx          # Deep ocean blue minimal responsive footer
│   ├── PageContainer.jsx   # Consistent responsive wrapper container
│   └── PageTitle.jsx       # Branded placeholder title component
│
├── pages/
│   ├── Home.jsx            # Home page placeholder
│   ├── AboutUs.jsx         # About Us page placeholder
│   ├── Shop.jsx            # Shop catalog placeholder
│   ├── Categories.jsx      # Categories navigation placeholder
│   └── Profile.jsx         # Profile page placeholder
│
├── assets/
│   └── logo.png            # Crisp transparent KASHVIMLM brand logo
│
├── App.jsx                 # Top-level shell with Router, Layout & Route definitions
├── main.jsx                # React root mounting point
└── index.css               # Centralized design system, typography & component styles
```

---

## 🧭 Routes

| Route | Page Component | Placeholder Content |
| :--- | :--- | :--- |
| `/` | [`Home.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/Home.jsx) | **KASHVIMLM** &bull; **Home** |
| `/about` | [`AboutUs.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/AboutUs.jsx) | **KASHVIMLM** &bull; **About Us** |
| `/shop` | [`Shop.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/Shop.jsx) | **KASHVIMLM** &bull; **Shop** |
| `/categories` | [`Categories.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/Categories.jsx) | **KASHVIMLM** &bull; **Categories** |
| `/profile` | [`Profile.jsx`](file:///C:/Users/msila/OneDrive/Desktop/VSCode/Kashvimlm/src/pages/Profile.jsx) | **KASHVIMLM** &bull; **Profile** |

---

## 💻 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

### 4. Lint Codebase
```bash
npm run lint
```
