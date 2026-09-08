document.addEventListener('DOMContentLoaded', () => {
  const firebaseConfig = {
    apiKey: "AIzaSyD6YYN18UwaqRtygcN0SK8qpa5D8A0KZBw",
    authDomain: "bemarket-78787.firebaseapp.com",
    projectId: "bemarket-78787",
    storageBucket: "bemarket-78787.appspot.com",
    messagingSenderId: "442650361143",
    appId: "1:442650361143:web:6c3d3809a6ca6a528f6eb2"
  };

  let db;
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
  } catch (err) {
    console.error("Ошибка Firebase:", err);
  }

  // Создание уникального идентификатора владельца устройств
  let userToken = localStorage.getItem('bemarket_user_token');
  if (!userToken) {
    userToken = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('bemarket_user_token', userToken);
  }

  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const closeModalCross = document.getElementById('closeModalCross');
  const modalOverlay = document.getElementById('modalOverlay');
  const productForm = document.getElementById('productForm');
  const productsGrid = document.getElementById('productsGrid');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const cooldownTimer = document.getElementById('cooldownTimer');
  const submitBtn = document.getElementById('submitBtn');
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const notification = document.getElementById('notification');

  const priceInput = document.getElementById('priceInput');
  const negotiableCheckbox = document.getElementById('negotiableCheckbox');

  let allProducts = [];
  let lastPostTime = 0;
  const COOLDOWN_DURATION = 3 * 60 * 1000;

  if (negotiableCheckbox && priceInput) {
    negotiableCheckbox.addEventListener('change', () => {
      if (negotiableCheckbox.checked) {
        priceInput.value = '';
        priceInput.disabled = true;
      } else {
        priceInput.disabled = false;
      }
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      themeToggleBtn.textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
    });
  }

  const openModal = () => modalOverlay && modalOverlay.classList.remove('hidden');
  const closeModal = () => modalOverlay && modalOverlay.classList.add('hidden');

  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (closeModalCross) closeModalCross.addEventListener('click', closeModal);

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  function showNotification(msg) {
    if (!notification) return;
    notification.textContent = msg;
    notification.classList.remove('hidden');
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }

  function checkCooldown() {
    if (!cooldownTimer || !submitBtn) return true;
    const now = Date.now();
    const timePassed = now - lastPostTime;
    if (timePassed < COOLDOWN_DURATION) {
      const remainingSeconds = Math.ceil((COOLDOWN_DURATION - timePassed) / 1000);
      cooldownTimer.textContent = `Подождите ${remainingSeconds} сек. перед следующим объявлением.`;
      cooldownTimer.classList.remove('hidden');
      submitBtn.disabled = true;
      return false;
    }
    cooldownTimer.classList.add('hidden');
    submitBtn.disabled = false;
    return true;
  }

  setInterval(checkCooldown, 1000);

  function processAndCompressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
    });
  }

  function formatPhoneForWa(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '996' + clean.slice(1);
    }
    return clean;
  }

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!checkCooldown()) return;

      if (!db) {
        alert("Ошибка подключения к Firebase!");
        return;
      }

      const isNegotiable = negotiableCheckbox ? negotiableCheckbox.checked : false;
      const priceVal = priceInput ? priceInput.value.trim() : '';

      if (!isNegotiable && !priceVal) {
        alert("Укажите цену товара или отметьте 'Договорная / Обмен'");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Публикация...';

      const title = document.getElementById('titleInput').value.trim();
      const category = document.getElementById('categorySelect').value;
      const floor = document.getElementById('floorSelect').value;
      const place = document.getElementById('placeInput').value.trim();
      const condition = document.getElementById('conditionSelect').value;
      const phone = document.getElementById('phoneInput').value.trim();
      const imageFile = document.getElementById('imageInput').files[0];

      let displayPrice = isNegotiable ? 'Договорная / Обмен' : `${priceVal} сом`;

      try {
        let imageUrl = '';
        if (imageFile) {
          imageUrl = await processAndCompressImage(imageFile);
        }

        await db.collection('products').add({
          title,
          category,
          price: displayPrice,
          floor,
          place,
          condition,
          phone,
          imageUrl,
          ownerToken: userToken,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        lastPostTime = Date.now();
        productForm.reset();
        if (priceInput) priceInput.disabled = false;
        closeModal();
        showNotification('✅ Товар успешно выставлен!');
      } catch (error) {
        console.error("Ошибка сохранения:", error);
        alert("Ошибка при выкладывании товара.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Опубликовать';
      }
    });
  }

  // Функция для удаления товара
  window.deleteProduct = async (docId) => {
    if (confirm("Вы уверены, что хотите снять этот товар с продажи?")) {
      try {
        await db.collection('products').doc(docId).delete();
        showNotification('🗑 Товар снят с продажи!');
      } catch (err) {
        console.error("Ошибка при удалении:", err);
        alert("Не удалось удалить товар.");
      }
    }
  };

  function filterAndRender() {
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const selectedCat = categoryFilter ? categoryFilter.value : 'all';

    const filtered = allProducts.filter(item => {
      const matchesSearch = (item.title && item.title.toLowerCase().includes(query)) ||
                            (item.place && item.place.toLowerCase().includes(query)) ||
                            (item.price && item.price.toLowerCase().includes(query));
      
      let matchesCat = false;
      if (selectedCat === 'all') {
        matchesCat = true;
      } else if (selectedCat === 'my') {
        matchesCat = item.ownerToken === userToken;
      } else {
        matchesCat = item.category === selectedCat;
      }

      return matchesSearch && matchesCat;
    });

    renderProducts(filtered);
  }

  function renderProducts(items) {
    productsGrid.innerHTML = '';
    if (items.length === 0) {
      productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; opacity: 0.7;">Товары не найдены.</p>';
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card';
      
      const imgHtml = item.imageUrl 
        ? `<img src="${escapeHtml(item.imageUrl)}" class="card-img" alt="Фото товара">`
        : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;opacity:0.5;">Без фото</div>`;

      const waPhone = formatPhoneForWa(item.phone);
      const waMsg = encodeURIComponent(`Здравствуйте! Меня заинтересовал товар "${item.title}" (${item.price}) в бутике ${item.place}.`);

      const isMyProduct = item.ownerToken === userToken;
      const deleteBtnHtml = isMyProduct && item.id
        ? `<button onclick="deleteProduct('${item.id}')" class="btn-delete">🗑 Снять с продажи</button>`
        : '';

      card.innerHTML = `
        ${imgHtml}
        <div class="card-price">${escapeHtml(item.price || 'Договорная')}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="card-info">
          <div class="badges">
            <span class="badge badge-cat">${escapeHtml(item.category || 'Общее')}</span>
            <span class="badge">${escapeHtml(item.condition)}</span>
          </div>
          <p><strong>Этаж:</strong> ${escapeHtml(item.floor)}</p>
          <p><strong>Бутик / Место:</strong> ${escapeHtml(item.place)}</p>
        </div>
        <div class="contact-btns">
          <a href="tel:${escapeHtml(item.phone)}" class="phone-btn">📞 Звонок</a>
          <a href="https://wa.me/${waPhone}?text=${waMsg}" target="_blank" class="wa-btn">💬 WhatsApp</a>
        </div>
        ${deleteBtnHtml}
      `;
      productsGrid.appendChild(card);
    });
  }

  if (db && productsGrid) {
    db.collection('products')
      .onSnapshot((snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
          allProducts.push({
            id: doc.id,
            ...doc.data()
          });
        });
        filterAndRender();
      }, (err) => {
        console.error("Ошибка чтения данных:", err);
      });
  }

  if (searchInput) searchInput.addEventListener('input', filterAndRender);
  if (categoryFilter) categoryFilter.addEventListener('change', filterAndRender);

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }
});