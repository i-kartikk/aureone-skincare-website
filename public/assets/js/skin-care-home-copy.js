(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

  const grid = $('#product-grid');
  const featuredRail = $('#bestsellers');
  const ritualList = $('#ritual-list');
  const filters = $('#category-filters');
  const search = $('#product-search');
  const sort = $('#product-sort');
  const count = $('#results-count');
  const errorPanel = $('#load-error');
  const retryButton = $('#retry-load');
  const video = $('#ritual-video');
  const videoToggle = $('.video-toggle');

  const routine = [
    { step: '01', title: 'Clean', slug: 'rice-veil' },
    { step: '02', title: 'Treat', slugs: ['radiance-5', 'aqua-balance', 'radiance-c'] },
    { step: '03', title: 'Glow', slug: 'lumiere-c' },
    { step: '04', title: 'Moisturize', slug: 'velvet-barrier' },
    { step: '05', title: 'Protect', slug: 'solar-veil' }
  ];
  const state = { products: [], category: 'All', query: '', sort: 'featured' };

  function productUrl(product) {
    return `/product/${encodeURIComponent(product.slug)}`;
  }

  function productImage(product) {
    return product.cardImage || product.images?.[0] || '';
  }

  function productCard(product) {
    const price = Number(product.price);
    const comparePrice = Number(product.comparePrice);
    const image = productImage(product);
    return `
      <article class="product-card">
        <a class="product-image-link" href="${productUrl(product)}" aria-label="View ${escapeHtml(product.name)}">
          <img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
        </a>
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h3><a href="${productUrl(product)}">${escapeHtml(product.name)}</a></h3>
        <p class="product-subtitle">${escapeHtml(product.subtitle)}</p>
        <div class="product-price-row">
          <strong>${money(price)}</strong>
          ${comparePrice > price ? `<del>${money(comparePrice)}</del>` : ''}
          <a class="text-link" href="${productUrl(product)}">Discover <span aria-hidden="true">→</span></a>
        </div>
      </article>`;
  }

  function renderRoutine() {
    const productsBySlug = new Map(state.products.map(product => [product.slug, product]));
    const stages = routine.map(stage => ({
      ...stage,
      product: stage.slug ? productsBySlug.get(stage.slug) : stage.slugs.map(slug => productsBySlug.get(slug)).find(Boolean)
    }))
      .filter(stage => stage.product);

    if (!stages.length) {
      ritualList.innerHTML = '<p class="empty-state">The daily ritual is not available right now.</p>';
      return;
    }

    ritualList.innerHTML = stages.map(({ step, title, product }) => `
      <a class="ritual-step" href="${productUrl(product)}">
        <span class="step-topline"><span>${step} / ${title}</span><span>${escapeHtml(product.category)}</span></span>
        <img src="${escapeHtml(product.images?.[0] || productImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.subtitle)}</small>
      </a>`).join('');
  }

  function renderFilters() {
    const categories = ['All', ...new Set(state.products.map(product => product.category).filter(Boolean))];
    if (!categories.includes(state.category)) state.category = 'All';
    filters.innerHTML = categories.map(category => `
      <button class="filter-button" type="button" data-category="${escapeHtml(category)}"
        aria-pressed="${String(category === state.category)}">${escapeHtml(category)}</button>`).join('');

    filters.querySelectorAll('[data-category]').forEach(button => {
      button.addEventListener('click', () => {
        state.category = button.dataset.category;
        renderFilters();
        renderCollection();
      });
    });
  }

  function sortedProducts(products) {
    const visible = [...products];
    if (state.sort === 'price-ascending') visible.sort((a, b) => Number(a.price) - Number(b.price));
    else if (state.sort === 'price-descending') visible.sort((a, b) => Number(b.price) - Number(a.price));
    else if (state.sort === 'name') visible.sort((a, b) => a.name.localeCompare(b.name));
    else visible.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    return visible;
  }

  function renderCollection() {
    const query = state.query.trim().toLocaleLowerCase();
    const visible = sortedProducts(state.products.filter(product => {
      const matchesCategory = state.category === 'All' || product.category === state.category;
      const haystack = [product.name, product.subtitle, product.category, product.tagline, product.description]
        .filter(Boolean).join(' ').toLocaleLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    }));

    count.textContent = `${visible.length} ${visible.length === 1 ? 'formula' : 'formulas'}`;
    grid.innerHTML = visible.length
      ? visible.map(productCard).join('')
      : '<p class="empty-state">No formulas match that search. Try another name or category.</p>';
  }

  function renderFeatured() {
    const featured = state.products.filter(product => product.featured).slice(0, 5);
    const products = featured.length ? featured : state.products.slice(0, 5);
    featuredRail.innerHTML = products.map(productCard).join('');
  }

  async function loadProducts() {
    errorPanel.hidden = true;
    retryButton.disabled = true;
    grid.innerHTML = '<p class="loading-note">Loading the collection…</p>';
    featuredRail.innerHTML = '<p class="loading-note">Loading featured formulas…</p>';
    ritualList.innerHTML = '<p class="loading-note">Loading the daily ritual…</p>';

    try {
      const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Product request failed (${response.status}).`);
      const products = await response.json();
      if (!Array.isArray(products)) throw new Error('The product response was not a list.');
      state.products = products.filter(product => product && product.active !== false);
      renderRoutine();
      renderFilters();
      renderCollection();
      renderFeatured();
      errorPanel.hidden = true;
    } catch (error) {
      console.error('Unable to load the skincare collection:', error);
      grid.innerHTML = '';
      featuredRail.innerHTML = '';
      ritualList.innerHTML = '';
      count.textContent = '';
      errorPanel.hidden = false;
    } finally {
      retryButton.disabled = false;
    }
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    renderCollection();
  });
  sort.addEventListener('change', () => {
    state.sort = sort.value;
    renderCollection();
  });
  retryButton.addEventListener('click', loadProducts);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const setVideoToggle = isPlaying => {
    videoToggle.setAttribute('aria-label', isPlaying ? 'Pause featured skincare video' : 'Play featured skincare video');
    videoToggle.setAttribute('aria-pressed', String(!isPlaying));
    videoToggle.querySelector('span').textContent = isPlaying ? 'Pause film' : 'Play film';
  };
  video.addEventListener('play', () => setVideoToggle(true));
  video.addEventListener('pause', () => setVideoToggle(false));
  if (reducedMotion.matches) {
    video.pause();
    setVideoToggle(false);
  } else {
    video.play().catch(error => {
      console.error('The skincare film could not autoplay:', error);
      setVideoToggle(false);
    });
  }
  videoToggle.addEventListener('click', async () => {
    if (video.paused) {
      try {
        await video.play();
        setVideoToggle(true);
      } catch (error) {
        console.error('The skincare film could not play:', error);
        setVideoToggle(false);
      }
    } else {
      video.pause();
      setVideoToggle(false);
    }
  });

  loadProducts();
})();
