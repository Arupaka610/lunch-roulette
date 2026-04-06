/* ===== ランチルーレット App ===== */

const App = {
  userLocation: null,
  searchResults: [],
  selectedRestaurants: [],
  finalChoice: null,

  // ===== 初期化 =====
  init() {
    if (window.google?.maps?.places?.Place) {
      this.start();
    } else {
      window.__onGmapsReady = () => this.start();
    }
    this.bindEvents();
  },

  start() {
    this.showScreen('search');
    const { isIOS } = this.detectBrowser();
    if (isIOS) {
      // iOS はユーザーのタップでのみ取得（自動呼び出しはブロックされる）
      const text = document.getElementById('location-status-text');
      text.textContent = '📍 タップして現在地を取得';
    } else {
      this.getLocation();
    }
  },

  // ===== イベントバインド =====
  bindEvents() {
    document.getElementById('btn-search')
      .addEventListener('click', () => this.search());
    // 位置情報行全体をタップで取得（iOS Safariのジェスチャー要件に対応）
    document.getElementById('location-row')
      .addEventListener('click', () => this.getLocation());

    document.getElementById('btn-retry-roulette')
      .addEventListener('click', () => this.startRoulette());
    document.getElementById('btn-back-to-search')
      .addEventListener('click', () => this.showScreen('search'));

    document.getElementById('btn-back-to-roulette')
      .addEventListener('click', () => this.showScreen('roulette'));
    document.getElementById('btn-new-search')
      .addEventListener('click', () => this.showScreen('search'));
  },

  // ===== 位置情報取得 =====
  getLocation() {
    const text = document.getElementById('location-status-text');
    const dot = document.getElementById('location-dot');

    if (!navigator.geolocation) {
      text.textContent = '位置情報が利用できません';
      dot.className = 'location-dot error';
      return;
    }

    dot.className = 'location-dot loading';
    text.textContent = '位置情報を取得中...';

    const onSuccess = pos => {
      this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      dot.className = 'location-dot success';
      text.textContent = '位置情報を取得しました ✓';
    };

    const onError = (err, highAccuracy) => {
      // 高精度で失敗した場合は低精度で再試行
      if (highAccuracy && err.code !== 1) {
        navigator.geolocation.getCurrentPosition(onSuccess, onError2,
          { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 });
        return;
      }
      dot.className = 'location-dot error';
      if (err.code === 1) {
        text.innerHTML = this.getLocationDeniedMessage();
      } else if (err.code === 3) {
        text.textContent = '取得タイムアウト。行をタップして再試行してください';
      } else {
        text.textContent = '位置情報を取得できませんでした。行をタップして再試行してください';
      }
    };

    const onError2 = err => onError(err, false);

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      err => onError(err, true),
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  },

  // ===== 検索 =====
  async search() {
    if (!this.userLocation) {
      this.showToast('位置情報を取得中です。少し待ってから再試行してください');
      this.getLocation();
      return;
    }
    if (!window.google?.maps?.places?.Place) {
      this.showToast('Google Maps を読み込み中です。しばらくお待ちください');
      return;
    }

    const radius = parseInt(document.querySelector('input[name="radius"]:checked').value);
    const genre = document.getElementById('genre-select').value;
    const budget = document.getElementById('budget-select').value;

    this.showLoading(true, '近くのお店を検索中...');

    try {
      const fields = [
        'id', 'displayName', 'location', 'rating',
        'priceLevel', 'regularOpeningHours', 'currentOpeningHours', 'businessStatus',
      ];
      const center = new google.maps.LatLng(this.userLocation.lat, this.userLocation.lng);

      let places;

      if (genre) {
        // キーワード指定 → searchByText（locationBias で円形指定）
        ({ places } = await google.maps.places.Place.searchByText({
          textQuery: `${genre} 飲食店`,
          fields,
          locationBias: { center, radius },
          maxResultCount: 20,
        }));
      } else {
        // ジャンル未指定 → searchNearby
        ({ places } = await google.maps.places.Place.searchNearby({
          fields,
          locationRestriction: { center, radius },
          includedPrimaryTypes: ['restaurant'],
          maxResultCount: 20,
        }));
      }

      // 予算フィルター（クライアント側）
      if (budget && places?.length) {
        const budgetMap = {
          '1': ['FREE', 'INEXPENSIVE'],
          '2': ['MODERATE'],
          '3': ['EXPENSIVE'],
          '4': ['VERY_EXPENSIVE'],
        };
        const allowed = budgetMap[budget];
        if (allowed) {
          const filtered = places.filter(p => {
            if (!p.priceLevel) return false;
            const lvl = String(p.priceLevel).toUpperCase();
            return allowed.includes(lvl);
          });
          if (filtered.length >= 3) places = filtered;
        }
      }

      this.showLoading(false);

      if (!places || places.length === 0) {
        this.showToast('条件に合うお店が見つかりませんでした。範囲を広げてみてください');
        return;
      }

      // 営業中のお店を優先（isOpen が関数でない場合は無視）
      const open = places.filter(p => {
        try {
          const oh = p.regularOpeningHours;
          return oh && typeof oh.isOpen === 'function' && oh.isOpen() === true;
        } catch { return false; }
      });
      this.searchResults = open.length >= 3 ? open : places;
      this.startRoulette();

    } catch (e) {
      this.showLoading(false);
      this.showToast('検索に失敗しました');
      console.error('Search error:', e);
    }
  },

  // ===== ルーレット開始 =====
  startRoulette() {
    const shuffled = [...this.searchResults].sort(() => Math.random() - 0.5);
    this.selectedRestaurants = shuffled.slice(0, Math.min(3, shuffled.length));

    this.showScreen('roulette');
    document.getElementById('roulette-subtitle').textContent = 'お店を選んでいます...';
    document.getElementById('roulette-actions').classList.remove('visible');

    for (let i = 0; i < 3; i++) {
      const card = document.getElementById(`roulette-card-${i}`);
      card.className = 'roulette-card';
      card.onclick = null;
      card.querySelector('.roulette-card-content').innerHTML =
        '<div class="card-placeholder">🎲</div>';
      card.style.display = i < this.selectedRestaurants.length ? 'flex' : 'none';
    }

    this.selectedRestaurants.forEach((restaurant, index) => {
      setTimeout(() => this.spinCard(index, restaurant), index * 900);
    });

    const totalDelay = this.selectedRestaurants.length * 900 + 1400;
    setTimeout(() => {
      document.getElementById('roulette-subtitle').textContent =
        'カードをタップしてお店を選んでください';
      document.getElementById('roulette-actions').classList.add('visible');
    }, totalDelay);
  },

  // ===== カードスピンアニメーション =====
  spinCard(index, restaurant) {
    const card = document.getElementById(`roulette-card-${index}`);
    const content = card.querySelector('.roulette-card-content');
    const allNames = this.searchResults.map(r => r.displayName || '');

    card.className = 'roulette-card spinning';

    const interval = setInterval(() => {
      const fake = allNames[Math.floor(Math.random() * allNames.length)];
      content.innerHTML = `<div class="card-name" style="opacity:0.6">${fake}</div>`;
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      card.className = 'roulette-card revealed clickable';
      content.innerHTML = this.buildCardHTML(restaurant);
      card.onclick = () => this.selectCard(index, restaurant, card);
    }, 1200);
  },

  buildCardHTML(restaurant) {
    const rating = restaurant.rating != null ? `${restaurant.rating}` : null;
    const priceLevel = this.priceLevelToYen(restaurant.priceLevel);
    const open = this.getOpenNow(restaurant);
    const openLabel = open != null ? (open ? '営業中' : '準備中') : null;

    const infoItems = [
      rating ? `<span class="stars">⭐ ${rating}</span>` : '',
      priceLevel ? `<span>${priceLevel}</span>` : '',
      openLabel ? `<span style="color:${open ? '#4CAF50' : '#999'}">${open ? '🟢' : '🔴'} ${openLabel}</span>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="card-name">${restaurant.displayName || ''}</div>
      ${infoItems ? `<div class="card-info">${infoItems}</div>` : ''}
    `;
  },

  // ===== カード選択 =====
  selectCard(index, restaurant, card) {
    document.querySelectorAll('.roulette-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    this.finalChoice = restaurant;
    setTimeout(() => this.fetchAndShowDetail(restaurant), 400);
  },

  // ===== 詳細取得 =====
  async fetchAndShowDetail(restaurant) {
    this.showLoading(true, '詳細情報を取得中...');
    try {
      await restaurant.fetchFields({
        fields: [
          'id', 'displayName', 'formattedAddress', 'nationalPhoneNumber',
          'rating', 'priceLevel', 'regularOpeningHours', 'currentOpeningHours',
          'websiteURI', 'userRatingCount', 'reviews',
        ],
      });
    } catch (e) {
      console.warn('fetchFields failed, using cached data:', e);
    } finally {
      this.showLoading(false);
      try {
        this.renderDetail(restaurant);
      } catch (e) {
        console.warn('renderDetail failed:', e);
        // 最低限の情報だけ表示
        document.getElementById('detail-name').textContent = restaurant.displayName || '不明';
        document.getElementById('detail-meta').innerHTML = '';
        document.getElementById('detail-hours').textContent = '';
        document.getElementById('detail-address').textContent = '';
        document.getElementById('detail-phone-section').style.display = 'none';
        document.getElementById('btn-website').style.display = 'none';
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.displayName || '')}&query_place_id=${restaurant.id}`;
        document.getElementById('btn-maps').href = mapsUrl;
      }
      this.showScreen('detail');
    }
  },

  renderDetail(place) {
    const name = place.displayName || '';
    const rating = place.rating;
    const ratingTotal = place.userRatingCount;
    const address = place.formattedAddress || '住所情報なし';
    const phone = place.nationalPhoneNumber || '';
    const priceLevel = this.priceLevelToYen(place.priceLevel);
    const website = place.websiteURI || '';
    const isOpen = this.getOpenNow(place);

    document.getElementById('detail-name').textContent = name;

    const badges = [];
    if (rating != null) {
      const label = ratingTotal
        ? `⭐ ${rating}（${ratingTotal.toLocaleString()}件）`
        : `⭐ ${rating}`;
      badges.push(`<span class="detail-badge stars">${label}</span>`);
    }
    if (priceLevel) {
      badges.push(`<span class="detail-badge price">${priceLevel}</span>`);
    }
    if (isOpen != null) {
      badges.push(
        `<span class="detail-badge ${isOpen ? 'open' : 'closed'}">${isOpen ? '🟢 営業中' : '🔴 営業時間外'}</span>`
      );
    }
    document.getElementById('detail-meta').innerHTML = badges.join('');

    // 本日の営業時間のみ表示（weekdayDescriptions は月曜=0, 日曜=6）
    const hoursEl = document.getElementById('detail-hours');
    const weekdays = place.regularOpeningHours?.weekdayDescriptions;
    if (weekdays?.length >= 7) {
      const jsDay = new Date().getDay(); // 0=日, 1=月, ..., 6=土
      const googleIdx = jsDay === 0 ? 6 : jsDay - 1;
      const todayStr = weekdays[googleIdx] || '';
      // 曜日部分を除いて時間だけ表示（例「月曜日: 11:00〜15:00」→「🕐 11:00〜15:00」）
      const timeOnly = todayStr.replace(/^.+?:\s*/, '');
      hoursEl.innerHTML = `<div class="today-hours">🕐 ${timeOnly}</div>`;
    } else {
      hoursEl.textContent = '';
    }

    document.getElementById('detail-address').textContent = address;

    const phoneSection = document.getElementById('detail-phone-section');
    if (phone) {
      document.getElementById('detail-phone').textContent = phone;
      phoneSection.style.display = 'block';
    } else {
      phoneSection.style.display = 'none';
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${place.id}`;
    document.getElementById('btn-maps').href = mapsUrl;

    // 口コミ（カード内）
    this.renderReviews(place.reviews);

    const websiteBtn = document.getElementById('btn-website');
    if (website) {
      websiteBtn.href = website;
      websiteBtn.style.display = 'inline-flex';
    } else {
      websiteBtn.style.display = 'none';
    }
  },

  renderReviews(reviews) {
    const reviewsEl = document.getElementById('detail-reviews');
    if (!reviews?.length) {
      reviewsEl.innerHTML = '';
      return;
    }

    reviewsEl.innerHTML = `
      <div class="reviews-title">💬 口コミ</div>
      ${reviews.slice(0, 3).map(r => {
        const author = r.authorAttribution?.displayName || '匿名';
        const stars = '⭐'.repeat(Math.round(r.rating || 0));
        const text = typeof r.text === 'string' ? r.text : (r.text?.text || '');
        const time = r.relativePublishTimeDescription || '';
        return `<div class="review-card">
          <div class="review-header">
            <span class="review-author">${author}</span>
            <span class="review-stars">${stars}</span>
            <span class="review-time">${time}</span>
          </div>
          ${text ? `<div class="review-text">${text}</div>` : ''}
        </div>`;
      }).join('')}
    `;
  },

  // ===== ユーティリティ =====
  detectBrowser() {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
    const isChrome = /CriOS|Chrome/.test(ua);
    const isFirefox = /FxiOS|Firefox/.test(ua);
    return { isIOS, isAndroid, isSafari, isChrome, isFirefox };
  },

  getLocationDeniedMessage() {
    const { isIOS, isAndroid, isSafari, isChrome, isFirefox } = this.detectBrowser();

    if (isIOS && isSafari) {
      return '📱 設定アプリ → Safari → 位置情報 → 許可<br>またはアドレスバー「ぁあ」→ Webサイトの設定 → 位置情報 → 許可';
    }
    if (isIOS && isChrome) {
      return '📱 設定アプリ → Chrome → 位置情報 → 許可';
    }
    if (isIOS && isFirefox) {
      return '📱 設定アプリ → Firefox → 位置情報 → 許可';
    }
    if (isIOS) {
      return '📱 設定アプリ → プライバシーとセキュリティ → 位置情報サービス → ブラウザ → 許可';
    }
    if (isAndroid && isChrome) {
      return '🤖 アドレスバーの🔒 → 権限 → 位置情報 → 許可';
    }
    if (isAndroid && isFirefox) {
      return '🤖 アドレスバーの🔒 → 位置情報 → 許可';
    }
    if (isAndroid) {
      return '🤖 ブラウザの設定から位置情報を許可してください';
    }
    if (isSafari) {
      return '💻 Safari → 設定 → Webサイト → 位置情報 → 許可';
    }
    if (isFirefox) {
      return '💻 アドレスバーの🔒 → 接続のセキュリティ → 位置情報 → 許可';
    }
    // Chrome / Edge など
    return '💻 アドレスバーの🔒 → 位置情報 → 許可';
  },

  // regularOpeningHours から営業中かどうかを取得（isOpen関数 or openNow プロパティ対応）
  getOpenNow(place) {
    // currentOpeningHours → regularOpeningHours の順で確認
    for (const oh of [place?.currentOpeningHours, place?.regularOpeningHours]) {
      if (!oh) continue;
      try {
        if (typeof oh.isOpen === 'function') return oh.isOpen();
        if (oh.openNow != null) return oh.openNow;
      } catch { }
    }
    return null;
  },

  priceLevelToYen(priceLevel) {
    const map = {
      FREE: '', INEXPENSIVE: '¥', MODERATE: '¥¥',
      EXPENSIVE: '¥¥¥', VERY_EXPENSIVE: '¥¥¥¥',
    };
    return (priceLevel && map[priceLevel]) || '';
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${name}-screen`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 画面が表示されてから広告を初期化（非表示要素への適用を防ぐ）
    setTimeout(() => {
      const screen = document.getElementById(`${name}-screen`);
      screen.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])').forEach(() => {
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { }
      });
    }, 100);
  },

  showLoading(show, text = '読み込み中...') {
    const el = document.getElementById('loading-overlay');
    el.querySelector('.loading-text').textContent = text;
    el.classList.toggle('active', show);
  },

  showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
