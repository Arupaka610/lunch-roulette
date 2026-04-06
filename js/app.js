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
    // 自動取得を試みる（iOS Safari では失敗する場合あり → 行タップで再試行）
    this.getLocation();
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
    const dot  = document.getElementById('location-dot');

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
        text.innerHTML = '拒否されました。Safari設定 → このWebサイト → 位置情報 → 許可';
      } else if (err.code === 3) {
        text.textContent = '取得タイムアウト。↺ ボタンで再試行してください';
      } else {
        text.textContent = '位置情報を取得できませんでした';
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
    const genre  = document.getElementById('genre-select').value;
    const budget = document.getElementById('budget-select').value;

    this.showLoading(true, '近くのお店を検索中...');

    try {
      const fields = [
        'id', 'displayName', 'location', 'rating',
        'priceLevel', 'regularOpeningHours', 'businessStatus',
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
    const card     = document.getElementById(`roulette-card-${index}`);
    const content  = card.querySelector('.roulette-card-content');
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
    const rating     = restaurant.rating != null ? `${restaurant.rating}` : null;
    const priceLevel = this.priceLevelToYen(restaurant.priceLevel);
    const oh = restaurant.regularOpeningHours;
    const open = oh && typeof oh.isOpen === 'function' ? oh.isOpen() : null;
    const openLabel = open != null ? (open ? '営業中' : '準備中') : null;

    const infoItems = [
      rating     ? `<span class="stars">⭐ ${rating}</span>` : '',
      priceLevel ? `<span>${priceLevel}</span>` : '',
      openLabel  ? `<span style="color:${open ? '#4CAF50' : '#999'}">${open ? '🟢' : '🔴'} ${openLabel}</span>` : '',
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
          'rating', 'priceLevel', 'regularOpeningHours',
          'websiteURI', 'userRatingCount',
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
    const name        = place.displayName || '';
    const rating      = place.rating;
    const ratingTotal = place.userRatingCount;
    const address     = place.formattedAddress || '住所情報なし';
    const phone       = place.nationalPhoneNumber || '';
    const priceLevel  = this.priceLevelToYen(place.priceLevel);
    const website     = place.websiteURI || '';
    const _oh = place.regularOpeningHours;
    const isOpen = _oh && typeof _oh.isOpen === 'function' ? _oh.isOpen() : null;

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

    const hoursEl = document.getElementById('detail-hours');
    const weekdays = place.regularOpeningHours?.weekdayDescriptions;
    if (weekdays?.length) {
      hoursEl.innerHTML = weekdays.map(t => `<div>${t}</div>`).join('');
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

    const websiteBtn = document.getElementById('btn-website');
    if (website) {
      websiteBtn.href = website;
      websiteBtn.style.display = 'inline-flex';
    } else {
      websiteBtn.style.display = 'none';
    }
  },

  // ===== ユーティリティ =====
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
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
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
