# Oracle APEX-এ React Application Integration: সম্পূর্ণ গাইড

## 📖 Introduction

Oracle APEX একটি শক্তিশালী low-code platform, কিন্তু complex UI-এর জন্য React ব্যবহার করা আরও কার্যকর। এই গাইডে আমরা **React + Vite app** কে **Oracle APEX**-এ properly embed করার পদ্ধতি শেখাব।

---

## 🎯 Why React + APEX?

| Feature | APEX Alone | APEX + React |
|---------|-----------|--------------|
| UI Complexity | Limited | Advanced |
| Component Reusability | Moderate | High |
| Performance | Good | Better |
| Developer Experience | Okay | Excellent |
| Integration | Native | Seamless |

---

## 🔧 Prerequisites

আপনার যা থাকতে হবে:
- **Node.js** v18+ ([download](https://nodejs.org/))
- **npm/bun** (comes with Node.js)
- **Oracle APEX** workspace access
- **Vite + React** project
- **Oracle ORDS** (database APIs expose করার জন্য)

---

## 📋 Step 1: React Application সেটআপ

### 1.1 Vite দিয়ে নতুন project তৈরি করুন
```bash
npm create vite@latest my-react-app -- --template react
cd my-react-app
npm install
```

### 1.2 Development চেক করুন
```bash
npm run dev
```
`http://localhost:5173/` এ open করে দেখুন app চলছে।

---

## 📦 Step 2: Production Build তৈরি করুন

### 2.1 Build কমান্ড চালান
```bash
npm run build
```

এটি `/dist` ফোল্ডারে bundle তৈরি করবে:
```plaintext
dist/
├── assets/
│   ├── index-XXXXX.js
│   └── index-XXXXX.css
├── index.html
└── vite.svg
```

### 2.2 ⚠️ গুরুত্বপূর্ণ: Consistent Filenames

APEX-এ যখন file reference update করবেন না বার বার সেজন্য, `vite.config.js` update করুন:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app.[ext]',
      }
    }
  }
})
```

এখন build করলে **`assets/app.js`** এবং **`assets/app.css`** পাবেন (hash ছাড়া)।

---

## 🌐 Step 3: APEX-এ Upload করুন

### 3.1 APEX application খুলুন
- **App Builder** → আপনার app → **Shared Components**

### 3.2 Static Application Files-এ যান
- **Shared Components** → **Files and Reports** → **Static Application Files**

### 3.3 JS File upload করুন
- **Create** → `dist/assets/app.js` সিলেক্ট করুন
- Upload করুন
- **Reference** icon click করে path copy করুন (e.g., `#APP_FILES#app.js`)

### 3.4 CSS File upload করুন
- একই ভাবে `dist/assets/app.css` upload করুন
- Reference copy করুন (e.g., `#APP_FILES#app.css`)

---

## 📄 Step 4: APEX Page তৈরি করুন

### 4.1 নতুন Blank Page তৈরি করুন
- **App Builder** → **Create Page** → **Blank Page**
- Page name দিন (e.g., "Organization Hierarchy")

### 4.2 Static Content Region যোগ করুন
- **Body** → right-click → **Create Region**
- **Type:** `Static Content`
- **HTML Code:**
```html
<div id="root"></div>
```

### 4.3 Region Template সেট করুন
- **Template:** `Blank with Attributes` (APEX theme conflict avoid করতে)

---

## 🔗 Step 5: CSS & JS Reference যোগ করুন

### 5.1 Page Properties খুলুন
- Page root select করুন → **Page Properties** খুলুন

### 5.2 CSS যোগ করুন
- **CSS → File URLs:** 
```
#APP_FILES#app.css
```

### 5.3 JS যোগ করুন (Method 1: Direct)
- **JavaScript → File URLs:**
```
#APP_FILES#app.js
```
> **Important:** JS must load as `type="module"`

### 5.4 JS যোগ করুন (Method 2: Inline Code) — যদি Method 1 না কাজ করে
- **JavaScript → Execute when Page Loads:**
```
var script = document.createElement('script');
script.type = 'module';
script.crossOrigin = 'anonymous';
script.src = apex.env.APP_FILE_PREFIX + 'app.js';
document.head.appendChild(script);
```

---

## 🛠️ Step 6: React কোডে APEX Integration

### 6.1 APEX Global Variables access করুন
React app-এ APEX session/environment info access করতে:

````jsx
// src/App.jsx
import { useEffect, useState } from 'react';

function App() {
  const [apexSession, setApexSession] = useState(null);

  useEffect(() => {
    // APEX context access করুন
    if (window.apex?.env?.APP_SESSION) {
      setApexSession(window.apex.env.APP_SESSION);
      console.log("APEX Session:", window.apex.env.APP_SESSION);
    }
  }, []);

  return (
    <div>
      <h1>Organization Hierarchy</h1>
      {apexSession && <p>Session: {apexSession}</p>}
    </div>
  );
}

export default App;
````

### 6.2 ORDS API কল করুন
````jsx
async function fetchOrgData() {
  try {
    const response = await fetch('/ords/your-schema/org-hierarchy/', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('API error:', error);
  }
}
````

---

## 🔄 Step 7: Updates করার পদ্ধতি

আপনার React app update করলে:

1. **Local code change করুন**
2. **Build করুন:**
   ```bash
   npm run build
   ```
3. **APEX-এ পুরানো file delete করুন:** Static Application Files থেকে
4. **নতুন app.js এবং app.css upload করুন**
5. **APEX page save করুন** (Ctrl+S)
6. **Run করুন**

> যদি filenames consistent রাখেন (hash ছাড়া), তাহলে reference update করতে হবে না।

---

## ⚠️ Common Issues & Solutions

### Issue 1: React app render হচ্ছে না
**Solution:**
- Browser console (F12) খুলে error check করুন
- নিশ্চিত করুন `<div id="root"></div>` page-এ আছে
- JS `type="module"` হিসেবে load হচ্ছে তা verify করুন

### Issue 2: CORS errors
**Solution:**
- ORDS enable করুন Cross-Origin access-এর জন্য
- নিশ্চিত করুন APEX domain-এ API call আসছে

### Issue 3: Styles broken দেখাচ্ছে
**Solution:**
- Region template set করুন **"Blank with Attributes"**
- এতে APEX theme conflict avoid হবে

### Issue 4: Links/Navigation কাজ করছে না
**Solution:**
- নিশ্চিত করুন app `window.apex.env.APP_SESSION` access করছে
- এটা শুধু APEX-এর ভিতরে work করে

---

## 📊 Example: Organization Hierarchy

আপনার repo-তে আছে যেমন structure:

````jsx
// src/App.jsx
import { useState, useEffect } from 'react';
import OrgChart from './components/OrgChart';

export default function App() {
  const [orgData, setOrgData] = useState([]);

  useEffect(() => {
    // ORDS API থেকে data fetch করুন
    fetchOrgHierarchy();
  }, []);

  const fetchOrgHierarchy = async () => {
    const response = await fetch('/ords/schema/org-hierarchy/');
    const data = await response.json();
    setOrgData(data.items);
  };

  return (
    <div className="app">
      <h1>📊 Organization Hierarchy</h1>
      <OrgChart data={orgData} />
    </div>
  );
}
````

---

## 🎓 Best Practices

✅ **করুন:**
- Production build use করুন deployment-এ
- CSS/JS file references consistent রাখুন
- APEX env variables safely access করুন
- Browser console monitor করুন development-এ

❌ **করবেন না:**
- Development server directly APEX-এ use করবেন না
- Sensitive data localStorage/sessionStorage-এ রাখবেন না
- APEX session ID expose করবেন না

---

## 🚀 Deployment Checklist

- [ ] Build successful হয়েছে (`npm run build`)
- [ ] `dist/assets/` files আছে
- [ ] APEX Static Files upload হয়েছে
- [ ] CSS & JS File URLs page-এ set আছে
- [ ] `<div id="root"></div>` region-এ আছে
- [ ] Region Template "Blank with Attributes"
- [ ] ORDS endpoints CORS enable আছে
- [ ] Page saved & tested

---

## 📚 Resources

- [React Official](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Oracle APEX Documentation](https://docs.oracle.com/en/database/oracle/application-express/latest/)
- [Oracle ORDS REST API](https://docs.oracle.com/en/database/oracle/application-express/latest/aetds/)

---

## 🎉 Conclusion

এখন আপনি জানেন:
✅ React + Vite app build করতে
✅ APEX-এ properly integrate করতে
✅ ORDS API use করতে
✅ Updates manage করতে

Happy coding! 🚀

---

**Questions?** GitHub issue open করুন বা documentation আপডেট করুন!