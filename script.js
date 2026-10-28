// ===== SINCRONIZACIÓN CON LA NUBE (Firestore) =====
// Todo lo que se guarda en estas claves de localStorage se replica automáticamente
// en Firestore cuando hay una sesión iniciada (ver index.html: fbSaveData / fbInitLibrary).
const CINE_SYNC_KEYS = [
    'cine_watched_movies',
    'cine_watched_movies_data',
    'cine_watched_episodes',
    'cine_personal_reviews',
    'cine_custom_lists',
    'cine_diario_mural_posts',
    'cine_avatar_custom_url',
    'cine_default_tab',
    'cine_notif_read',
    'cine_hide_watched_public'
];
window.CINE_SYNC_KEYS = CINE_SYNC_KEYS;

const _rawSetItem = Storage.prototype.setItem;
const _rawRemoveItem = Storage.prototype.removeItem;
window.cineRawStorage = {
    set: (k, v) => _rawSetItem.call(localStorage, k, v),
    remove: (k) => _rawRemoveItem.call(localStorage, k)
};

function _cineQueueSync(key, value) {
    if (!CINE_SYNC_KEYS.includes(key)) return;
    if (window._suppressSync || !window._libraryReady || !window.currentUser || !window.fbSaveData) return;
    window.fbSaveData(key, value);
}
Storage.prototype.setItem = function (k, v) {
    _rawSetItem.call(this, k, v);
    if (this === localStorage) _cineQueueSync(k, String(v));
};
Storage.prototype.removeItem = function (k) {
    _rawRemoveItem.call(this, k);
    if (this === localStorage) _cineQueueSync(k, null);
};

// Aplica un valor llegado de la nube (string JSON o null) a las variables en memoria
window.cineApplyKey = function (key, raw) {
    try {
        switch (key) {
            case 'cine_watched_movies': watchedMovies = raw ? JSON.parse(raw) : []; break;
            case 'cine_watched_movies_data': watchedMoviesData = raw ? JSON.parse(raw) : {}; break;
            case 'cine_watched_episodes': watchedEpisodes = raw ? JSON.parse(raw) : {}; break;
            case 'cine_personal_reviews': personalReviews = raw ? JSON.parse(raw) : {}; break;
            case 'cine_custom_lists': customLists = raw ? JSON.parse(raw) : []; break;
            case 'cine_avatar_custom_url':
                currentAvatarCustomUrl = raw || null;
                window.currentAvatarCustomUrl = currentAvatarCustomUrl;
                break;
            case 'cine_default_tab': defaultMainTab = raw || 'mural'; break;
            case 'cine_notif_read':
                if (typeof _applyNotifReadRaw === 'function') _applyNotifReadRaw(raw);
                break;
            case 'cine_hide_watched_public': {
                const chk = document.getElementById('hideWatchedPublicCheck');
                if (chk) chk.checked = (raw === 'true');
                break;
            }
        }
    } catch (e) {
        console.warn('Dato inválido en', key, e);
    }
};

window.cineRefreshAfterSync = function () {
    const calls = [
        () => renderCustomLists(),
        () => renderResultsGrid(),
        () => renderMuralFeed(),
        () => updateProfileDrawerStats(),
        () => { if (typeof window.refreshNotifications === 'function') window.refreshNotifications(); }
    ];
    calls.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
};
// ===== FIN SINCRONIZACIÓN =====

// ===== MODALES DEL PERFIL (vistas, apuntes, cuadernos) =====
const _pmEsc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let _pmItems = [];

function _pmPoster(url, cls) {
    const fallback = `<div class="${cls} flex items-center justify-center bg-stone-200 dark:bg-stone-800 text-stone-400"><i class="fa-solid fa-film"></i></div>`;
    if (!url || /placeholder/.test(url)) return fallback;
    const thumb = typeof thumbPoster === 'function' ? thumbPoster(url, 'w342') : url;
    return `<img src="${_pmEsc(thumb)}" loading="lazy" decoding="async" class="${cls} object-cover bg-stone-200 dark:bg-stone-800" onerror="this.outerHTML=this.dataset.fb" data-fb="${_pmEsc(fallback)}">`;
}

function openProfileModal(id) {
    const drawer = document.getElementById('profileDrawer');
    if (drawer && !drawer.classList.contains('translate-x-full')) toggleProfileDrawer();
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
}
function closeProfileModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
}
function openProfileItem(i) {
    const it = _pmItems[i];
    if (!it) return;
    if (it.postId) {
        closeProfileModal('notesModal');
        closeProfileModal('watchedModal');
        closeProfileModal('listsModal');
        openMuralPostModal(it.postId);
        return;
    }
    openDetailModal({
        id: it.id,
        title: it.title,
        subtitle: it.subtitle || '',
        poster: it.poster,
        rating: it.rating || '8.5',
        overview: it.overview || 'Sin descripción',
        votes: it.votes,
        year: it.year,
        mediaType: it.mediaType,
        scopeLabel: it.scopeLabel
    }, it.tag || 'Mi perfil');
}

window._viewedUserLib = null;

function _activeLib() {
    if (window._viewedUserLib && !window._viewedUserLib.isMe) return window._viewedUserLib;
    return {
        isMe: true,
        name: currentUsername,
        watchedMovies,
        watchedMoviesData,
        personalReviews,
        customLists
    };
}

function _pmMovie(id, lib) {
    const src = lib || _activeLib();
    const parsed = _parseMediaId(id);
    const d = (src.watchedMoviesData && src.watchedMoviesData[id])
        || (src.personalReviews && src.personalReviews[id] && src.personalReviews[id].movie)
        || (parsed.isTv && src.watchedMoviesData && src.watchedMoviesData[parsed.baseId])
        || watchedMoviesData[id]
        || (personalReviews[id] && personalReviews[id].movie)
        || (parsed.isTv && watchedMoviesData[parsed.baseId])
        || null;
    const base = d
        ? { id: d.id ?? id, title: d.title || 'Sin título', subtitle: d.subtitle || '', poster: d.poster, rating: d.rating, overview: d.overview, year: d.year, votes: d.votes, mediaType: d.mediaType || (parsed.isTv ? 'tv' : undefined), scopeLabel: d.scopeLabel }
        : { id, title: (parsed.isTv ? 'Serie #' + parsed.tmdbId : 'Película #' + id), poster: null, mediaType: parsed.isTv ? 'tv' : undefined };
    if (typeof _resolveViewerMovie === 'function') {
        const loc = _resolveViewerMovie({ type: 'review', tmdbMovieId: id, movieObj: base });
        if (loc) return { ...base, ...loc, id, scopeLabel: base.scopeLabel || loc.scopeLabel };
    }
    return base;
}

function openWatchedMoviesModal(useViewedUser) {
    if (!useViewedUser) window._viewedUserLib = null;
    openProfileModal('watchedModal');
    const inp = document.getElementById('watchedSearchInput');
    if (inp) inp.value = '';
    renderWatchedModal();
}
function renderWatchedModal() {
    const body = document.getElementById('watchedModalBody');
    if (!body) return;
    const lib = _activeLib();
    const q = (document.getElementById('watchedSearchInput')?.value || '').trim().toLowerCase();
    document.getElementById('watchedModalCount').innerText = lib.watchedMovies.length;
    const movies = [...lib.watchedMovies].reverse().map(id => _pmMovie(id, lib)).filter(m => m.title.toLowerCase().includes(q));
    _pmItems = movies.map(m => ({ ...m, tag: lib.isMe ? 'Vistas' : `Vistas por ${lib.name}` }));
    if (!movies.length) {
        body.innerHTML = `<p class="text-center py-10 text-stone-400 text-xs italic">${lib.watchedMovies.length ? 'Sin resultados.' : (lib.isMe ? 'Aún no has marcado películas como vistas.' : 'Aún no ha marcado películas como vistas.')}</p>`;
        return;
    }
    body.innerHTML = `<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">` + movies.map((m, i) => {
        const r = lib.personalReviews[m.id]?.rating;
        return `<div onclick="openProfileItem(${i})" title="${_pmEsc(m.title)}" class="relative group cursor-pointer journal-border overflow-hidden hover:border-rose-800 transition">
            ${_pmPoster(m.poster, 'w-full aspect-[2/3]')}
            ${r ? `<span class="absolute top-1 right-1 text-[9px] font-mono font-bold bg-stone-950/80 text-amber-400 px-1.5 py-0.5"><i class="fa-solid fa-star"></i> ${Number(r).toFixed(1)}</span>` : ''}
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/95 to-transparent p-1.5 pt-6 opacity-0 group-hover:opacity-100 transition">
                <span class="block text-[10px] font-heading font-bold text-stone-100 leading-tight">${_pmEsc(m.title)}</span>
            </div></div>`;
    }).join('') + `</div>`;
}

function openPersonalNotesModal(useViewedUser) {
    if (!useViewedUser) window._viewedUserLib = null;
    openProfileModal('notesModal');
    const inp = document.getElementById('notesSearchInput');
    if (inp) inp.value = '';
    renderNotesModal();
}
function prunePersonalReviews() {
    if (!personalReviews || typeof personalReviews !== 'object') return;
    let changed = false;
    Object.keys(personalReviews).forEach(k => {
        const n = personalReviews[k];
        const hasText = !!(n && ((n.review && String(n.review).trim()) || (n.reviewTitle && String(n.reviewTitle).trim())));
        const hasRating = !!(n && Number(n.rating) > 0);
        if (!n || (!hasText && !hasRating)) {
            delete personalReviews[k];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));
    }
}

function countValidPersonalReviews(mapObj) {
    const src = mapObj || personalReviews || {};
    return Object.keys(src).filter(k => {
        const n = src[k];
        return n && ((n.review && String(n.review).trim()) || (n.reviewTitle && String(n.reviewTitle).trim()) || Number(n.rating) > 0);
    }).length;
}

function renderNotesModal() {
    const body = document.getElementById('notesModalBody');
    if (!body) return;
    const lib = _activeLib();
    if (lib.isMe) prunePersonalReviews();
    const q = (document.getElementById('notesSearchInput')?.value || '').trim().toLowerCase();
    const muralList = typeof getCommunityAndUserPosts === 'function' ? getCommunityAndUserPosts() : [];
    const all = Object.keys(lib.personalReviews).map(id => {
        const n = lib.personalReviews[id];
        const idStr = String(id);
        let postId = n && n.postId;
        if (!postId && n && n.isPublic !== false && n.review) {
            const match = muralList.find(p =>
                p.type === 'review' &&
                String(p.tmdbMovieId || (p.movieObj && p.movieObj.id)) === idStr &&
                (lib.isMe ? p.mine : ((lib.uid && p.authorUid === lib.uid) || String(p.author || '').toLowerCase() === String(lib.name || '').toLowerCase()))
            );
            if (match) postId = match.id;
        }
        return { ...n, _idKey: id, _m: _pmMovie(id, lib), _postId: postId || null };
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .filter(n => (n.review || n.reviewTitle || n.rating) && (lib.isMe || n.isPublic !== false));
    document.getElementById('notesModalCount').innerText = all.length;
    const notes = all.filter(n => (n._m.title + ' ' + (n.reviewTitle || '')).toLowerCase().includes(q));
    _pmItems = notes.map(n => ({ ...n._m, tag: lib.isMe ? 'Mis apuntes' : `Apunte de ${lib.name}`, postId: n._postId }));
    if (!notes.length) {
        body.innerHTML = `<p class="text-center py-10 text-stone-400 text-xs italic">${all.length ? 'Sin resultados.' : (lib.isMe ? 'Aún no has escrito apuntes. Hazlo desde el detalle de cualquier película.' : 'Aún no tiene apuntes públicos.')}</p>`;
        return;
    }
    body.innerHTML = `<div class="space-y-2.5">` + notes.map((n, i) => {
        const onWall = n.isPublic !== false && !!(n.review && String(n.review).trim()) && (!window.muralReady || !!n._postId);
        const statusLabel = onWall ? 'Público' : (n.isPublic === false ? 'Privado' : 'Solo ficha');
        const statusIcon = onWall ? 'fa-earth-americas' : (n.isPublic === false ? 'fa-lock' : 'fa-bookmark');
        const statusCls = onWall ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-500';
        const scopeBadge = n._m.scopeLabel ? `<span class="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-amber-600/15 text-amber-700 dark:text-amber-400 border border-amber-600/30 font-bold ml-1">${_pmEsc(n._m.scopeLabel)}</span>` : '';
        return `
        <div onclick="openProfileItem(${i})" class="flex gap-3 p-2.5 bg-stone-100 dark:bg-stone-950 journal-border cursor-pointer hover:border-rose-800 transition">
            ${_pmPoster(n._m.poster, 'w-14 h-20 flex-shrink-0 journal-border')}
            <div class="min-w-0 flex-grow">
                <div class="flex items-start justify-between gap-2">
                    <h4 class="font-heading font-bold text-xs text-rose-900 dark:text-rose-400 truncate">${_pmEsc(n.reviewTitle || n._m.title)}${scopeBadge}</h4>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 journal-border ${statusCls}"><i class="fa-solid ${statusIcon} mr-1"></i>${statusLabel}</span>
                        ${lib.isMe ? `<button type="button" onclick="event.stopPropagation(); confirmDeletePersonalReview('${_pmEsc(n._idKey)}')" title="Eliminar apunte" class="px-1.5 py-0.5 text-[10px] text-stone-400 hover:text-rose-600 journal-border bg-stone-200/60 dark:bg-stone-900 transition cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    </div>
                </div>
                <div class="text-[10px] font-mono text-stone-500 mt-0.5">${_pmEsc(n._m.title)}${n._m.scopeLabel ? ` · ${_pmEsc(n._m.scopeLabel)}` : ''}${n.rating ? ` · <span class="text-amber-600"><i class="fa-solid fa-star"></i> ${Number(n.rating).toFixed(1)}</span>` : ''}${n.updatedAt ? ` · ${relTime(n.updatedAt)}` : ''}</div>
                ${n.review ? `<p class="text-xs font-serif italic text-stone-700 dark:text-stone-300 mt-1.5 leading-relaxed" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${_pmEsc(n.review)}</p>` : ''}
            </div>
        </div>`;
    }).join('') + `</div>`;
}

function openCustomListsModal(useViewedUser) {
    if (!useViewedUser) window._viewedUserLib = null;
    openProfileModal('listsModal');
    renderListsModal();
}
function renderListsModal(openIdx) {
    const body = document.getElementById('listsModalBody');
    if (!body) return;
    const lib = _activeLib();
    const lists = lib.isMe ? lib.customLists : (lib.customLists || []).filter(l => l && l.isPublic !== false);
    document.getElementById('listsModalCount').innerText = lists.length;
    if (!lists.length) {
        body.innerHTML = `<p class="text-center py-10 text-stone-400 text-xs italic">${lib.isMe ? 'Sin cuadernos creados. Puedes crear uno desde el catálogo.' : 'Aún no tiene cuadernos públicos.'}</p>`;
        return;
    }
    _pmItems = [];
    body.innerHTML = `<div class="space-y-3">` + lists.map((l, li) => {
        const isPublic = l.isPublic !== false;
        const ms = (l.movies || []).map(m => {
            const obj = typeof m === 'object' ? m : { title: m };
            const loc = (obj.id && typeof _resolveViewerMovie === 'function') ? _resolveViewerMovie({ type: 'review', tmdbMovieId: obj.id, movieObj: obj }) : null;
            return { ...obj, ...(loc || {}), tag: 'Cuaderno: ' + l.name };
        });
        const start = _pmItems.length;
        _pmItems.push(...ms);
        const thumbs = ms.slice(0, 4).map(m => _pmPoster(m.poster, 'w-8 h-12 journal-border')).join('');
        const grid = ms.length
            ? `<div class="grid grid-cols-4 sm:grid-cols-5 gap-2">${ms.map((m, mi) => `<div onclick="openProfileItem(${start + mi})" title="${_pmEsc(m.title)}" class="cursor-pointer group">
                    <div class="journal-border overflow-hidden group-hover:border-rose-800 transition">${_pmPoster(m.poster, 'w-full aspect-[2/3]')}</div>
                    <span class="block text-[9px] font-serif text-stone-600 dark:text-stone-400 truncate mt-0.5">${_pmEsc(m.title)}</span></div>`).join('')}</div>`
            : `<p class="text-[11px] italic text-stone-400 text-center py-2">Este cuaderno está vacío.</p>`;
        return `<div class="bg-stone-100 dark:bg-stone-950 journal-border">
            <div onclick="document.getElementById('lmBody_${li}').classList.toggle('hidden')" class="p-3 flex items-center justify-between cursor-pointer hover:bg-stone-200/50 dark:hover:bg-stone-900 transition">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="fa-solid fa-book text-rose-800 text-xs"></i>
                    <h4 class="text-xs font-heading font-bold text-rose-900 dark:text-rose-400 truncate">${_pmEsc(l.name)}</h4>
                    <i class="fa-solid ${isPublic ? 'fa-globe text-stone-400' : 'fa-lock text-amber-600'} text-[10px]" title="${isPublic ? 'Público' : 'Privado'}"></i>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0"><div class="hidden sm:flex gap-1">${thumbs}</div><span class="text-[10px] font-mono bg-stone-200 dark:bg-stone-900 px-2 py-0.5 journal-border">${ms.length} obras</span></div>
            </div>
            <div id="lmBody_${li}" class="${li === openIdx ? '' : 'hidden'} border-t border-stone-200 dark:border-stone-800 p-3 bg-stone-50 dark:bg-stone-900/50">${grid}</div>
        </div>`;
    }).join('') + `</div>`;
}

window.refreshOpenProfileModals = function () {
    const open = (id) => { const m = document.getElementById(id); return m && !m.classList.contains('hidden'); };
    if (open('watchedModal')) renderWatchedModal();
    if (open('notesModal')) renderNotesModal();
    if (open('listsModal')) {
        const lib = _activeLib();
        const lists = lib.isMe ? lib.customLists : (lib.customLists || []).filter(l => l && l.isPublic !== false);
        const opened = lists.findIndex((_, i) => { const b = document.getElementById('lmBody_' + i); return b && !b.classList.contains('hidden'); });
        renderListsModal(opened);
    }
};
// ===== FIN MODALES DEL PERFIL =====

// ===== RULETA, ÓSCARS, FILTROS DEL CATÁLOGO Y AVATAR =====
const _movieReg = new Map();
function _regMovie(m, tag) {
    const key = tag + '|' + m.id;
    if (!_movieReg.has(key)) _movieReg.set(key, { idx: _movieReg.size });
    const e = _movieReg.get(key);
    e.m = m; e.tag = tag;
    return e.idx;
}
function openRegisteredMovie(i) {
    for (const e of _movieReg.values()) {
        if (e.idx === i) {
            openDetailModal({
                ...e.m,
                id: e.m.id,
                title: e.m.title,
                subtitle: e.m.subtitle || '',
                poster: e.m.poster,
                rating: e.m.rating || '8.5',
                overview: e.m.overview || 'Sin descripción',
                votes: e.m.votes,
                year: e.m.year,
                mediaType: e.m.mediaType,
                scopeLabel: e.m.scopeLabel
            }, e.tag);
            return;
        }
    }
}
function _findMovieById(id) {
    const pools = [
        [currentDetailMovie, currentWinnerMovie],
        fetchedResults, moviesList, currentOscarList,
        customLists.flatMap(l => (l.movies || []).filter(m => typeof m === 'object')),
        Object.values(personalReviews).map(r => r && r.movie)
    ];
    for (const pool of pools) {
        const f = pool.find(m => m && String(m.id) === String(id));
        if (f) return f;
    }
    return null;
}

// ----- Catálogo -----
function getVisibleCatalogMovies() {
    const q = (document.getElementById('catalogSearchFilter')?.value || '').trim().toLowerCase();
    const w = document.getElementById('watchedFilterSelect')?.value || 'ALL';
    const seen = new Set();
    return fetchedResults.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        const watched = watchedMovies.includes(m.id);
        if (w === 'WATCHED' && !watched) return false;
        if (w === 'UNWATCHED' && watched) return false;
        if (q && !((m.title || '') + ' ' + (m.subtitle || '')).toLowerCase().includes(q)) return false;
        return true;
    });
}
function applyCatalogFilters() { renderResultsGrid(); }
function loadNextFilteredPage() { return loadNextFilteredPageAutomatically(); }
function updateCatalogCount() {
    const el = document.getElementById('catalogCountIndicator');
    if (el) el.innerText = `${getVisibleCatalogMovies().length} obras`;
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.classList.toggle('hidden', currentFilterPage >= totalFilterPages);
}

// ----- Detalle -----
function renderDetailPublicReviews(movie) {
    const box = document.getElementById('detailPublicReviewsContainer');
    if (!box) return;
    let posts = [];
    try {
        posts = getCommunityAndUserPosts().filter(p => String(p.tmdbMovieId ?? (p.movieObj && p.movieObj.id)) === String(movie.id)).slice(0, 5);
    } catch (e) { /* sin comentarios */ }
    if (!posts.length) {
        box.innerHTML = `<p class="text-[11px] font-serif italic text-stone-400 text-center py-2">Aún no hay comentarios sobre esta obra.</p>`;
        return;
    }
    box.innerHTML = posts.map(p => `
        <div onclick="closeDetailModal(); openMuralPostModal('${_pmEsc(p.id)}')" class="p-2 bg-stone-100 dark:bg-stone-950 journal-border cursor-pointer hover:border-rose-800 transition">
            <div class="flex items-center justify-between text-[10px] font-mono text-stone-500">
                <span class="font-bold text-rose-900 dark:text-rose-400">${_pmEsc(p.author)}</span>
                ${p.rating ? `<span class="text-amber-600"><i class="fa-solid fa-star"></i> ${_fmtRating(p.rating)}</span>` : ''}
            </div>
            <p class="text-[11px] font-serif italic text-stone-700 dark:text-stone-300 mt-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${_pmEsc(p.reviewTitle || p.title || p.content || '')}</p>
        </div>`).join('');
}
function updateWinnerWatchedUI(movieId) {
    const btn = document.getElementById('winnerWatchedBtn');
    if (!btn) return;
    const w = watchedMovies.includes(movieId);
    btn.className = `absolute top-2 right-2 p-1.5 text-xs transition shadow-md journal-border cursor-pointer text-stone-100 ${w ? 'bg-emerald-800' : 'bg-stone-900/80 hover:bg-rose-900'}`;
    btn.innerHTML = `<i id="winnerWatchedIcon" class="fa-${w ? 'solid fa-eye' : 'regular fa-eye-slash'}"></i>`;
    btn.title = w ? 'Marcar como no vista' : 'Marcar como vista';
}

// ----- Ruleta -----
const WHEEL_COLORS = ['#9f1239', '#44403c', '#b45309', '#78716c', '#be123c', '#a16207', '#57534e', '#881337'];

function addMoviesToRoulette(list) {
    const ids = new Set(moviesList.map(m => m.id));
    let added = 0;
    (list || []).forEach(m => { if (m && !ids.has(m.id)) { moviesList.push(m); ids.add(m.id); added++; } });
    refreshRoulette();
    return added;
}
function removeFromRoulette(id) { moviesList = moviesList.filter(m => String(m.id) !== String(id)); refreshRoulette(); }
function clearList() { moviesList = []; refreshRoulette(); }

function refreshRoulette() {
    const count = document.getElementById('movieCount');
    if (count) count.innerText = moviesList.length;
    const chips = document.getElementById('movieChipsList');
    if (chips) {
        chips.innerHTML = moviesList.length
            ? moviesList.map(m => `<span class="inline-flex items-center gap-1.5 bg-stone-200 dark:bg-stone-800 journal-border px-2 py-0.5 text-[10px] font-serif">${_pmEsc(m.title)}<button onclick="removeFromRoulette('${_pmEsc(m.id)}')" class="text-stone-400 hover:text-rose-600" title="Quitar"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
            : `<span class="text-[11px] italic text-stone-400">Selección vacía. Añade obras desde el catálogo o los Óscars.</span>`;
    }
    drawWheel();
}

function drawWheel() {
    const canvas = document.getElementById('rouletteCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width, c = size / 2, r = c - 12;
    const dark = document.documentElement.classList.contains('dark');
    ctx.clearRect(0, 0, size, size);
    const n = moviesList.length;

    if (n === 0) {
        ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? '#1c1917' : '#e7e5e4'; ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = dark ? '#44403c' : '#a8a29e'; ctx.stroke();
        ctx.fillStyle = dark ? '#a8a29e' : '#57534e';
        ctx.textAlign = 'center'; ctx.font = 'italic 38px serif';
        ctx.fillText('Añade películas', c, c - 70);
        ctx.fillText('al sorteo', c, c - 25);
        return;
    }

    const arc = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
        const a0 = startAngle + i * arc;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, a0, a0 + arc); ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = dark ? '#0c0a09' : '#fafaf9'; ctx.stroke();

        ctx.save();
        ctx.translate(c, c); ctx.rotate(a0 + arc / 2);
        ctx.fillStyle = '#fafaf9'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.max(14, Math.min(32, Math.floor(r * arc * 0.45)))}px serif`;
        const maxChars = n > 16 ? 12 : n > 8 ? 18 : 24;
        let t = String(moviesList[i].title || '');
        if (t.length > maxChars) t = t.slice(0, maxChars - 1) + '…';
        ctx.fillText(t, r - 28, 0);
        ctx.restore();
    }
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.lineWidth = 8; ctx.strokeStyle = dark ? '#a8a29e' : '#1c1917'; ctx.stroke();
}

function wheelIndexAtPointer() {
    const n = moviesList.length;
    if (!n) return -1;
    const TAU = Math.PI * 2;
    const a = (((1.5 * Math.PI - startAngle) % TAU) + TAU) % TAU;
    return Math.min(n - 1, Math.floor(a / (TAU / n)));
}

function spinWheel() {
    if (isSpinning) return;
    if (moviesList.length === 0) { showToast('Añade al menos una película al sorteo.', 'info'); return; }
    if (moviesList.length === 1) { showWinnerModal(moviesList[0]); return; }

    isSpinning = true;
    const btn = document.getElementById('spinCenterBtn');
    if (btn) btn.disabled = true;

    const TAU = Math.PI * 2;
    const from = startAngle;
    const total = (5 + Math.random() * 3) * TAU + Math.random() * TAU;
    const duration = 4500 + Math.random() * 1500;
    const t0 = performance.now();

    const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        startAngle = from + total * (1 - Math.pow(1 - t, 4));
        drawWheel();
        const idx = wheelIndexAtPointer();
        if (idx !== lastSegmentIndex) { lastSegmentIndex = idx; playTickSound(); }
        if (t < 1) { requestAnimationFrame(frame); return; }

        startAngle = startAngle % TAU;
        isSpinning = false;
        if (btn) btn.disabled = false;
        const winner = moviesList[wheelIndexAtPointer()];
        playVictorySound();
        if (typeof confetti === 'function') confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        if (winner) showWinnerModal(winner);
    };
    requestAnimationFrame(frame);
}

async function getRandomRecommendation() {
    let pool = moviesList.length ? moviesList : getVisibleCatalogMovies();
    if (!pool.length && !_catalogInitialized) {
        _catalogInitialized = true;
        currentFilterPage = 3;
        await fetchMultipleFilteredPages();
        pool = getVisibleCatalogMovies();
    }
    if (!pool.length) { showToast('No hay películas disponibles. Añade obras al sorteo o espera a que cargue el catálogo.', 'info'); return; }
    closeModal();
    showWinnerModal(pool[Math.floor(Math.random() * pool.length)]);
}

function addAllFilteredToRoulette() {
    const visible = getVisibleCatalogMovies();
    if (!visible.length) { showToast('No hay obras visibles para cargar.', 'info'); return; }
    const MAX = 30;
    const pick = visible.length > MAX ? [...visible].sort(() => Math.random() - 0.5).slice(0, MAX) : visible;
    const added = addMoviesToRoulette(pick);
    showToast(`${added} obras añadidas al sorteo.` + (visible.length > MAX ? ` (Muestra de ${MAX})` : ''), 'ok');
}

// ----- Óscars -----
async function setOscarFilterMode(mode) {
    oscarMode = mode;
    const on = 'py-1 rounded-none text-xs font-serif font-semibold bg-amber-600 text-stone-50 transition';
    const off = 'py-1 rounded-none text-xs font-serif font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition';
    const w = document.getElementById('btnFilterWinners'), a = document.getElementById('btnFilterAll');
    if (w) w.className = mode === 'WINNERS' ? on : off;
    if (a) a.className = mode === 'ALL' ? on : off;
    const c = document.getElementById('oscarListContainer');
    if (c) c.innerHTML = `<p class="text-center py-4 text-stone-400 text-xs italic">Cargando...</p>`;
    await loadOscarMovies();
}

function renderOscarList() {
    const c = document.getElementById('oscarListContainer');
    if (!c) return;
    if (!currentOscarList.length) {
        c.innerHTML = `<p class="text-center py-4 text-stone-400 text-xs italic">No se pudo cargar el archivo histórico.</p>`;
        return;
    }
    c.innerHTML = currentOscarList.map(m => `
        <div class="flex items-center gap-2.5 p-2 bg-stone-100 dark:bg-stone-950 journal-border hover:border-amber-600 transition">
            <div onclick="openRegisteredMovie(${_regMovie(m, m.mediaType === 'tv' ? 'Archivo de Series (Emmy)' : 'Archivo de la Academia')})" class="flex items-center gap-2.5 flex-grow min-w-0 cursor-pointer">
                ${_pmPoster(m.poster, 'w-9 h-14 flex-shrink-0 journal-border')}
                <div class="min-w-0">
                    <span class="block text-xs font-heading font-bold truncate">${_pmEsc(m.title)}</span>
                    <span class="block text-[10px] font-mono ${m.isWinner ? 'text-amber-600' : 'text-stone-500'}"><i class="fa-solid ${m.isWinner ? 'fa-trophy' : 'fa-award'} mr-1"></i>${m.isWinner ? 'Ganadora' : 'Nominada'} · ${m.oscarYear}</span>
                </div>
            </div>
            <button onclick="addMoviesToRoulette([_findMovieById('${_pmEsc(m.id)}')]); showToast('Añadida al sorteo ✓', 'ok');" title="Añadir al sorteo" class="flex-shrink-0 text-stone-400 hover:text-amber-600 px-1.5 text-sm transition"><i class="fa-solid fa-plus"></i></button>
        </div>`).join('');
}

function addAllOscarsToRoulette() {
    if (!currentOscarList.length) { showToast('La lista de los Óscars aún no ha cargado.', 'info'); return; }
    const added = addMoviesToRoulette(currentOscarList);
    showToast(`${added} obras añadidas al sorteo.`, 'ok');
}

// ----- Avatar ampliado -----
function openAvatarPreviewModal() {
    const img = document.getElementById('avatarPreviewImg');
    const name = document.getElementById('avatarPreviewName');
    if (img) img.src = getAvatarUrl();
    if (name) name.innerText = currentUsername;
    openProfileModal('avatarPreviewModal');
}

document.addEventListener('DOMContentLoaded', () => {
    const cv = document.getElementById('rouletteCanvas');
    if (cv) cv.addEventListener('click', () => spinWheel());
});
// ===== FIN RULETA / ÓSCARS / FILTROS / AVATAR =====

// ===== MURO COMPARTIDO (Firestore) =====
const POSTER_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="#292524"/><text x="50" y="84" font-size="34" text-anchor="middle">🎬</text></svg>');

function showToast(msg, type = 'ok') {
    let box = document.getElementById('toastBox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toastBox';
        box.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-2 pointer-events-none px-3';
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        document.body.appendChild(box);
    }
    const colors = {
        ok: 'bg-emerald-900 text-emerald-50 border-emerald-700',
        info: 'bg-stone-900 text-stone-100 border-stone-600',
        error: 'bg-rose-950 text-rose-50 border-rose-800'
    };
    const icons = { ok: 'fa-circle-check', info: 'fa-circle-info', error: 'fa-triangle-exclamation' };
    const el = document.createElement('div');
    el.className = `cz-toast pointer-events-auto flex items-center gap-2 border px-3.5 py-2 text-xs font-mono shadow-xl ${colors[type] || colors.info}`;
    const ic = document.createElement('i');
    ic.className = `fa-solid ${icons[type] || icons.info}`;
    const tx = document.createElement('span');
    tx.textContent = msg;
    el.append(ic, tx);
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3800);
}

function _isUserUnverified(u) {
    if (!u || u.emailVerified) return false;
    if (typeof window.isUnverifiedEmailUser === 'function') return window.isUnverifiedEmailUser(u);
    const provs = u.providerData || [];
    return provs.length === 0 || provs.some(p => p.providerId === 'password');
}

function requireAuth(msg) {
    if (window.currentUser && !_isUserUnverified(window.currentUser)) return true;
    if (window.currentUser && _isUserUnverified(window.currentUser)) {
        showToast('Verifica tu correo electrónico para participar en el muro.', 'info');
        if (typeof window.showAuthVerifyStep === 'function') window.showAuthVerifyStep(window.currentUser.email);
        return false;
    }
    showToast(msg || 'Inicia sesión para participar en el muro.', 'info');
    if (typeof window.showAuthLoginStep === 'function') window.showAuthLoginStep();
    const m = document.getElementById('authModal');
    if (m) m.classList.remove('hidden');
    return false;
}

function handleWriteError(err, what) {
    console.error('Error al ' + what + ':', err);
    const code = err && err.code ? err.code : '';
    if (code === 'permission-denied') {
        showToast(`No tienes permiso para ${what}. Revisa tu sesión y las reglas de Firestore.`, 'error');
    } else if (code === 'unavailable' || code === 'failed-precondition') {
        showToast('Sin conexión con la nube. Inténtalo de nuevo en un momento.', 'error');
    } else {
        showToast(`No se pudo ${what}.`, 'error');
    }
}

function relTime(ms) {
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 45) return 'Hace un momento';
    const m = Math.floor(s / 60);
    if (m < 60) return `Hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Ayer';
    if (d < 7) return `Hace ${d} días`;
    const dt = new Date(ms);
    return dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: dt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function safePoster(url) {
    return /^https:\/\/image\.tmdb\.org\//.test(url || '') ? url : POSTER_FALLBACK;
}

function thumbPoster(url, size = 'w342') {
    if (!/^https:\/\/image\.tmdb\.org\//.test(url || '')) return POSTER_FALLBACK;
    return url.replace('/t/p/w500/', `/t/p/${size}/`);
}

function _parseMediaId(rawId) {
    const str = String(rawId ?? '');
    const m = /^tv_(\d+)(?:_s(\d+)(?:_e(\d+))?)?$/i.exec(str);
    if (m) {
        return {
            isTv: true,
            tmdbId: Number(m[1]),
            baseId: `tv_${m[1]}`,
            seasonNumber: m[2] !== undefined ? Number(m[2]) : null,
            episodeNumber: m[3] !== undefined ? Number(m[3]) : null,
            fullId: str
        };
    }
    const num = Number(str);
    return {
        isTv: false,
        tmdbId: num || 0,
        baseId: num || str,
        seasonNumber: null,
        episodeNumber: null,
        fullId: num || str
    };
}

function slimMovie(m) {
    if (!m) return null;
    const rawId = m.id;
    const isTvStr = typeof rawId === 'string' && rawId.startsWith('tv_');
    const out = {
        id: isTvStr ? rawId : (Number(rawId) || 0),
        title: String(m.title || '').slice(0, 200),
        subtitle: String(m.subtitle || '').slice(0, 200),
        poster: /^https:\/\/image\.tmdb\.org\//.test(m.poster || '') ? m.poster : '',
        rating: m.rating != null ? String(m.rating).slice(0, 6) : null,
        overview: String(m.overview || '').slice(0, 600),
        year: m.year != null ? String(m.year).slice(0, 8) : null
    };
    if (isTvStr || m.mediaType === 'tv') out.mediaType = 'tv';
    if (m.scopeLabel) out.scopeLabel = String(m.scopeLabel).slice(0, 120);
    return out;
}

function _myName() { return String(currentUsername || 'Anónimo').slice(0, 40); }
function _avatarOf(seed, fallback) { return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed || fallback || 'x')}`; }
function _ms(ts) {
    if (!ts) return Date.now();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts === 'number') return ts;
    return Date.now();
}

function _countVotes(votes) {
    let agree = 0, disagree = 0;
    Object.values(votes || {}).forEach(v => { if (v === 'agree') agree++; else if (v === 'disagree') disagree++; });
    return { agree, disagree };
}

const _VIEWER_CACHE_KEY = 'cine_viewer_movie_cache_v1';
const _viewerMovieCache = new Map((() => {
    try { return Object.entries(JSON.parse(localStorage.getItem(_VIEWER_CACHE_KEY) || '{}')); }
    catch (e) { /* valor por defecto intencional */ return []; }
})());
const _viewerMoviePromises = new Map();
let _viewerMovieRefreshTimer = null;

function _saveViewerMovieCache() {
    try {
        const obj = {};
        for (const [k, v] of _viewerMovieCache.entries()) obj[k] = v;
        window.cineRawStorage.set(_VIEWER_CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.warn('No se pudo guardar caché local de películas del muro:', e);
    }
}

function _scheduleViewerMovieRefresh() {
    clearTimeout(_viewerMovieRefreshTimer);
    _viewerMovieRefreshTimer = setTimeout(() => {
        if (typeof renderMuralFeed === 'function') renderMuralFeed();
        if (typeof refreshPostModal === 'function') refreshPostModal();
        if (typeof window.refreshOpenProfileModals === 'function') window.refreshOpenProfileModals();
    }, 40);
}

function _viewerMovieKey(r) {
    if (!r || r.type !== 'review') return '';
    const base = r.movieObj || {};
    const rawId = r.tmdbMovieId || base.id || '';
    const parsed = _parseMediaId(rawId);
    const tLang = typeof currentTitleLang !== 'undefined' ? currentTitleLang : 'en-US';
    const iLang = typeof currentLang !== 'undefined' ? currentLang : 'es-MX';
    if (parsed.isTv && parsed.tmdbId) return `tv:${parsed.tmdbId}|${tLang}|${iLang}`;
    return parsed.tmdbId ? `id:${parsed.tmdbId}|${tLang}|${iLang}` : (base.title ? `q:${base.title}|${tLang}|${iLang}` : '');
}

function _ensureViewerMovie(r) {
    const key = _viewerMovieKey(r);
    if (!key || _viewerMovieCache.has(key)) return Promise.resolve();
    if (_viewerMoviePromises.has(key)) return _viewerMoviePromises.get(key);
    if (typeof fetchDualLanguageMovie !== 'function') return Promise.resolve();

    const base = r.movieObj || {};
    const rawId = r.tmdbMovieId || base.id || '';
    const parsed = _parseMediaId(rawId);
    const endpoint = parsed.isTv
        ? `/tv/${parsed.tmdbId}`
        : (parsed.tmdbId ? `/movie/${parsed.tmdbId}` : '');
    const req = (endpoint
        ? fetchDualLanguageMovie(endpoint)
        : (typeof fetchSearchMovieDual === 'function' ? fetchSearchMovieDual(base.title).then(res => (res && res[0]) || null) : Promise.resolve(null))
    ).then(loc => {
        _viewerMoviePromises.delete(key);
        if (loc) {
            _viewerMovieCache.set(key, loc);
            _saveViewerMovieCache();
            _scheduleViewerMovieRefresh();
        }
    }).catch(() => { _viewerMoviePromises.delete(key); });

    _viewerMoviePromises.set(key, req);
    return req;
}

function _resolveViewerMovie(r) {
    if (!r || r.type !== 'review') return r && r.movieObj ? r.movieObj : null;
    const base = r.movieObj || {};
    const key = _viewerMovieKey(r);
    if (!key) return r.movieObj || null;

    if (_viewerMovieCache.has(key)) {
        const cached = _viewerMovieCache.get(key);
        const merged = { ...base, ...cached, id: base.id || r.tmdbMovieId || cached.id };
        if (base.scopeLabel) merged.scopeLabel = base.scopeLabel;
        return merged;
    }
    _ensureViewerMovie(r);
    return r.movieObj || null;
}

function normPost(r) {
    const uid = window.currentUser ? window.currentUser.uid : null;
    const authorUid = r.authorUid || r.userId || '';
    const ms = _ms(r.createdAt);
    const edited = r.updatedAt && _ms(r.updatedAt) - ms > 60000;

    // Compatibilidad dual con estructura de votos nueva (votes) y antigua (reactions/userVotes)
    let reactions = _countVotes(r.votes);
    if (!r.votes && r.reactions) {
        reactions = { agree: Number(r.reactions.agree) || 0, disagree: Number(r.reactions.disagree) || 0 };
    }
    let myVote = uid && r.votes ? (r.votes[uid] || null) : null;
    if (!myVote && r.userVotes && currentUsername) {
        myVote = r.userVotes[currentUsername] || (uid ? r.userVotes[uid] : null) || null;
    }

    const commentCount = typeof r.commentCount === 'number'
        ? r.commentCount
        : (Array.isArray(r.comments) ? r.comments.length : 0);

    let lastComment = r.lastComment || null;
    if (!lastComment && Array.isArray(r.comments) && r.comments.length > 0) {
        const lc = r.comments[r.comments.length - 1];
        lastComment = { author: lc.author || 'Usuario', avatarSeed: lc.avatarSeed || '', text: String(lc.text || '').slice(0, 160) };
    }

    return {
        ...r,
        movieObj: _resolveViewerMovie(r),
        authorUid,
        author: r.author || 'Usuario',
        reactions,
        myVote,
        mine: !!uid && authorUid === uid,
        ms,
        date: relTime(ms) + (edited ? ' · editado' : ''),
        commentCount,
        lastComment
    };
}

function normComment(r) {
    const uid = window.currentUser ? window.currentUser.uid : null;
    const ms = _ms(r.createdAt);
    const edited = r.updatedAt && _ms(r.updatedAt) - ms > 60000;
    return {
        ...r,
        author: r.author || 'Usuario',
        reactions: _countVotes(r.votes),
        myVote: uid && r.votes ? (r.votes[uid] || null) : null,
        mine: !!uid && r.authorUid === uid,
        ms,
        date: relTime(ms) + (edited ? ' · editado' : '')
    };
}

window._extraPosts = window._extraPosts || {};
function getCommunityAndUserPosts() { return (window.muralPosts || []).map(normPost); }
function findPost(id) {
    const raw = (window.muralPosts || []).find(p => p.id === id) || window._extraPosts[id];
    return raw ? normPost(raw) : null;
}

// ----- Filtros y feed -----
function filterMural(filter, btn) {
    document.querySelectorAll('.mural-filter-btn').forEach(b => b.classList.remove('active'));
    const target = btn || (typeof event !== 'undefined' && event && event.currentTarget);
    if (target && target.classList) target.classList.add('active');
    renderMuralFeed(filter);
}

// ----- Orden del muro -----
const _SORT_MODES = ['date', 'reactions', 'comments'];
const _SORT_LABELS = {
    date: ['Más recientes primero', 'Más antiguas primero'],
    reactions: ['Más reaccionadas primero', 'Menos reaccionadas primero'],
    comments: ['Más comentadas primero', 'Menos comentadas primero']
};
function _loadMuralSort() {
    try {
        const v = JSON.parse(localStorage.getItem('cine_mural_sort'));
        if (v && _SORT_MODES.includes(v.mode) && (v.dir === 'asc' || v.dir === 'desc')) return v;
    } catch (e) { /* valor por defecto intencional */ }
    return { mode: 'date', dir: 'desc' };
}
window.muralSort = _loadMuralSort();

function syncMuralSortControls() {
    const sel = document.getElementById('muralSortSelect');
    if (sel) sel.value = window.muralSort.mode;
    const icon = document.getElementById('muralSortDirectionIcon');
    const desc = window.muralSort.dir === 'desc';
    if (icon) icon.className = desc ? 'fa-solid fa-arrow-down-wide-short' : 'fa-solid fa-arrow-up-short-wide';
    const btn = document.getElementById('muralSortDirectionBtn');
    if (btn) {
        const label = _SORT_LABELS[window.muralSort.mode][desc ? 0 : 1];
        btn.title = label + ' (clic para invertir)';
        btn.setAttribute('aria-label', label + '. Pulsa para invertir el orden');
    }
}
function _saveMuralSort() { localStorage.setItem('cine_mural_sort', JSON.stringify(window.muralSort)); }
function setMuralSort(mode) {
    if (!_SORT_MODES.includes(mode)) return;
    window.muralSort.mode = mode;
    _saveMuralSort();
    renderMuralFeed();
}
function toggleMuralSortDirection() {
    window.muralSort.dir = window.muralSort.dir === 'desc' ? 'asc' : 'desc';
    _saveMuralSort();
    renderMuralFeed();
}
function sortMuralPosts(posts) {
    const { mode, dir } = window.muralSort;
    const key = (p) => mode === 'reactions' ? p.reactions.agree + p.reactions.disagree : mode === 'comments' ? p.commentCount : p.ms;
    return posts.sort((a, b) => {
        const d = key(b) - key(a);
        if (d !== 0) return dir === 'desc' ? d : -d;
        return b.ms - a.ms;
    });
}

function _typeChip(type) {
    return type === 'review'
        ? `<span class="cz-chip text-rose-800 dark:text-rose-300 bg-rose-900/10 border-rose-900/30"><i class="fa-solid fa-feather-pointed"></i> Reseña</span>`
        : `<span class="cz-chip text-amber-700 dark:text-amber-300 bg-amber-600/10 border-amber-600/30"><i class="fa-solid fa-comments"></i> Debate</span>`;
}

function _fmtRating(r) {
    const n = Number(r);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function postCardHtml(p) {
    const movie = p.type === 'review' ? p.movieObj : null;
    const heading = p.type === 'review' ? p.reviewTitle : p.title;
    const rawTargetId = (movie && movie.id) || p.tmdbMovieId;
    const isTv = movie && (movie.mediaType === 'tv' || String(rawTargetId || '').startsWith('tv_'));
    const regIdx = movie ? _regMovie({ ...movie, id: rawTargetId }, 'Reseña de ' + p.author) : -1;
    const movieBox = movie ? `
        <div data-act="movie" data-reg="${regIdx}" class="cz-moviebox flex items-center gap-3 p-2 cursor-pointer">
            <img src="${_pmEsc(safePoster(movie.poster))}" alt="" loading="lazy" onerror="this.src='${POSTER_FALLBACK}'" class="w-12 h-[4.5rem] object-cover flex-shrink-0 shadow-md">
            <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                    ${isTv ? `<span class="text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 bg-amber-600/15 text-amber-700 dark:text-amber-400 border border-amber-600/30 font-bold"><i class="fa-solid fa-tv mr-0.5"></i>Serie</span>` : ''}
                    ${movie.scopeLabel ? `<span class="text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 bg-rose-900/15 text-rose-800 dark:text-rose-300 border border-rose-800/30 font-bold">${_pmEsc(movie.scopeLabel)}</span>` : ''}
                </div>
                <h4 class="font-heading font-bold text-sm leading-tight truncate">${_pmEsc(movie.title)}</h4>
                ${movie.subtitle ? `<span class="block text-[10px] font-serif italic text-stone-500 truncate">${_pmEsc(movie.subtitle)}</span>` : ''}
                ${p.rating != null ? `<span class="inline-flex items-center gap-1 mt-1 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400"><i class="fa-solid fa-star"></i> ${_fmtRating(p.rating)}<span class="text-stone-400 font-normal">/10</span></span>` : ''}
            </div>
        </div>` : '';
    const lc = p.lastComment;
    const preview = lc ? `
        <div class="cz-preview text-[11px] font-serif px-2.5 py-1.5 italic text-stone-600 dark:text-stone-400 truncate">
            <span class="font-bold not-italic text-stone-800 dark:text-stone-200">${_pmEsc(lc.author)}:</span> ${_pmEsc(lc.text)}
        </div>` : '';
    const ag = p.myVote === 'agree' ? 'cz-vote-on-agree' : '';
    const dg = p.myVote === 'disagree' ? 'cz-vote-on-disagree' : '';
    return `
    <article data-post="${_pmEsc(p.id)}" class="cz-card p-4 flex flex-col justify-between gap-3 cursor-pointer group">
        <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
                <button type="button" data-act="user" data-uid="${_pmEsc(p.authorUid)}" data-uname="${_pmEsc(p.author)}" data-useed="${_pmEsc(p.avatarSeed)}" class="flex items-center gap-2.5 min-w-0 text-left hover:opacity-80 transition">
                    <img src="${_avatarOf(p.avatarSeed, p.author)}" alt="" class="w-8 h-8 rounded-full cz-avatar flex-shrink-0">
                    <span class="min-w-0">
                        <span class="block font-heading text-[13px] font-bold truncate">${_pmEsc(p.author)}</span>
                        <span class="block text-[10px] font-mono text-stone-500 uppercase tracking-wide">${_pmEsc(p.date)}</span>
                    </span>
                </button>
                ${_typeChip(p.type)}
            </div>
            ${movieBox}
            ${heading ? `<h3 class="font-heading font-bold text-base leading-snug text-rose-900 dark:text-stone-100 group-hover:text-rose-800 dark:group-hover:text-rose-300 transition-colors">${_pmEsc(heading)}</h3>` : ''}
            <p class="cz-quote font-serif text-[13px] text-stone-700 dark:text-stone-300 leading-relaxed" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${_pmEsc(p.content)}</p>
            ${preview}
        </div>
        <div class="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-mono">
            <div class="flex items-center gap-1.5">
                <button type="button" data-act="vote" data-type="agree" aria-label="Estoy de acuerdo" class="cz-vote ${ag}"><i class="fa-solid fa-thumbs-up text-emerald-600"></i><span>${p.reactions.agree}</span></button>
                <button type="button" data-act="vote" data-type="disagree" aria-label="Discrepo" class="cz-vote ${dg}"><i class="fa-solid fa-thumbs-down text-rose-600"></i><span>${p.reactions.disagree}</span></button>
                <button type="button" data-act="open" aria-label="Ver comentarios" class="cz-vote"><i class="fa-solid fa-comments"></i><span>${p.commentCount}</span></button>
            </div>
            <span class="text-stone-500 dark:text-stone-400 font-bold group-hover:text-rose-800 dark:group-hover:text-rose-300 transition-colors">Ver debate →</span>
        </div>
    </article>`;
}

function _feedClick(e) {
    const act = e.target.closest('[data-act]');
    const card = e.target.closest('[data-post]');
    if (act && act.dataset.act === 'more') { window.fbLoadMorePosts(() => { renderMuralFeed(); refreshPostModal(); }); return; }
    if (!card) return;
    const id = card.dataset.post;
    if (act) {
        e.stopPropagation();
        const a = act.dataset.act;
        if (a === 'vote') reactToMuralPost(id, act.dataset.type);
        else if (a === 'user') openUserProfileModal(act.dataset.uid, act.dataset.uname, act.dataset.useed);
        else if (a === 'movie') openRegisteredMovie(Number(act.dataset.reg));
        else openMuralPostModal(id);
        return;
    }
    openMuralPostModal(id);
}

function renderMuralFeed(filter) {
    const feed = document.getElementById('muralPostsFeed');
    if (!feed) return;
    if (typeof filter === 'string') window.muralFilter = filter;
    const f = window.muralFilter || 'all';
    syncMuralSortControls();

    const rawList = window.muralPosts || [];
    const uncachedReviews = rawList.filter(r => r && r.type === 'review' && _viewerMovieKey(r) && !_viewerMovieCache.has(_viewerMovieKey(r)));
    if (!window.muralReady || uncachedReviews.length > 0) {
        if (uncachedReviews.length > 0) uncachedReviews.forEach(_ensureViewerMovie);
        if (!feed.children.length || !window.muralReady) {
            feed.innerHTML = Array.from({ length: 4 }, () => `<div class="cz-card p-4 space-y-3"><div class="flex items-center gap-2.5"><div class="cz-skeleton w-8 h-8 rounded-full"></div><div class="space-y-1.5 flex-grow"><div class="cz-skeleton h-3 w-1/3"></div><div class="cz-skeleton h-2 w-1/4"></div></div></div><div class="cz-skeleton h-16 w-full"></div><div class="cz-skeleton h-3 w-5/6"></div><div class="cz-skeleton h-3 w-2/3"></div></div>`).join('');
        }
        return;
    }
    if (window.muralError) {
        feed.innerHTML = `<div class="col-span-full text-center py-10 text-xs font-serif text-stone-500"><i class="fa-solid fa-plug-circle-exclamation text-2xl text-rose-800 mb-2 block"></i>No se pudo cargar el muro.<br><span class="font-mono text-[10px]">Revisa tu conexión y que las reglas de Firestore estén publicadas.</span></div>`;
        return;
    }
    const posts = sortMuralPosts(getCommunityAndUserPosts().filter(p => f === 'reviews' ? p.type === 'review' : f === 'discussions' ? p.type === 'discussion' : true));
    if (!posts.length) {
        feed.innerHTML = `<div class="col-span-full text-center py-12 text-stone-500"><i class="fa-regular fa-newspaper text-3xl mb-3 block text-stone-400"></i><p class="font-heading font-bold text-sm">${f === 'all' ? 'El muro está vacío' : 'Nada en esta sección todavía'}</p><p class="text-xs font-serif italic mt-1">Sé la primera persona en publicar una reseña o abrir un debate.</p></div>`;
        return;
    }
    feed.innerHTML = posts.map(postCardHtml).join('') +
        (window.muralHasMore ? `<div class="col-span-full text-center pt-2"><button type="button" data-act="more" class="px-4 py-2 text-xs font-mono uppercase tracking-wider cz-btn-ghost">Cargar más publicaciones</button></div>` : '');
    feed.onclick = _feedClick;
}

// ----- Detalle de publicación (con estética editorial y botones 100% reactivos) -----
function _movieBoxHtml(p) {
    if (p.type !== 'review' || !p.movieObj) {
        return `<div class="space-y-1">
            <span class="block text-[9px] font-mono uppercase tracking-widest text-amber-600 dark:text-amber-400 font-bold">Debate abierto</span>
            ${p.title ? `<h3 class="font-heading font-extrabold text-lg sm:text-xl text-stone-900 dark:text-stone-100 leading-tight">${_pmEsc(p.title)}</h3>` : ''}
        </div>`;
    }
    const m = p.movieObj;
    const rawTargetId = m.id || p.tmdbMovieId;
    const isTv = m.mediaType === 'tv' || String(rawTargetId || '').startsWith('tv_');
    const reg = _regMovie({ ...m, id: rawTargetId, rating: p.rating != null ? p.rating : m.rating }, isTv ? 'Reseña de serie' : 'Reseña cinematográfica');
    return `
        <div data-act="movie" data-reg="${reg}" class="flex items-center gap-4 cursor-pointer group">
            <img src="${_pmEsc(safePoster(m.poster))}" alt="" onerror="this.src='${POSTER_FALLBACK}'" class="w-24 h-36 object-cover flex-shrink-0 shadow-md journal-border group-hover:opacity-95 transition">
            <div class="min-w-0 space-y-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[9px] font-mono uppercase tracking-widest text-rose-700 dark:text-rose-400 font-bold">${isTv ? '📺 Reseña de serie TV' : 'Reseña cinematográfica'}</span>
                    ${m.scopeLabel ? `<span class="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-amber-600/15 text-amber-700 dark:text-amber-300 border border-amber-600/30 font-bold">${_pmEsc(m.scopeLabel)}</span>` : ''}
                </div>
                <h4 class="font-heading font-extrabold text-xl sm:text-2xl text-stone-900 dark:text-stone-100 leading-tight group-hover:text-rose-700 dark:group-hover:text-rose-300 transition">${_pmEsc(m.title)}</h4>
                ${m.subtitle ? `<span class="block text-xs font-serif italic text-stone-500 dark:text-stone-400">${_pmEsc(m.subtitle)}</span>` : ''}
                ${p.rating != null ? `<span class="inline-flex items-center gap-1 pt-1.5 text-amber-500 text-xs font-mono font-bold"><i class="fa-solid fa-star"></i>${_fmtRating(p.rating)}/10</span>` : ''}
            </div>
        </div>`;
}

function renderPostBody(p) {
    const el = document.getElementById('pmBody');
    if (!el) return;
    const isReview = p.type === 'review';
    const quoteText = isReview ? `"${_pmEsc(p.content)}"` : _pmEsc(p.content);
    el.innerHTML = `
        ${_movieBoxHtml(p)}
        <div class="relative bg-stone-100 dark:bg-[#11100f] p-3.5 sm:p-4 border border-stone-200 dark:border-stone-800/90 border-l-[3px] border-l-stone-400 dark:border-l-stone-700">
            <i class="fa-solid fa-quote-left absolute top-2.5 right-3.5 text-2xl text-stone-300/60 dark:text-stone-800/70 pointer-events-none select-none"></i>
            ${isReview && p.reviewTitle ? `<h3 class="font-heading font-bold text-sm sm:text-base text-rose-700 dark:text-rose-400 mb-1 pr-7">${_pmEsc(p.reviewTitle)}</h3>` : ''}
            <p class="font-serif text-xs sm:text-[13px] text-stone-700 dark:text-stone-300 leading-relaxed italic pr-5" style="white-space:pre-wrap">${quoteText}</p>
        </div>`;
}

function renderPostAuthor(p) {
    const el = document.getElementById('pmAuthor');
    if (!el) return;
    const roleLabel = p.type === 'review' ? 'CRÍTICO' : 'AUTOR';
    el.innerHTML = `
        <button type="button" data-act="user" data-uid="${_pmEsc(p.authorUid)}" data-uname="${_pmEsc(p.author)}" data-useed="${_pmEsc(p.avatarSeed)}" class="flex items-center gap-2.5 text-left hover:opacity-80 transition min-w-0 cursor-pointer">
            <img src="${_avatarOf(p.avatarSeed, p.author)}" alt="" class="w-8 h-8 rounded-full cz-avatar flex-shrink-0">
            <span class="min-w-0">
                <span class="block font-mono font-bold text-[11px] uppercase tracking-wider text-stone-900 dark:text-stone-100 truncate hover:underline">POR ${_pmEsc(p.author)}</span>
                <span class="block text-[9px] font-mono uppercase tracking-widest text-stone-500">${roleLabel} · ${_pmEsc(p.date)}</span>
            </span>
        </button>
        <div class="flex items-center gap-3 text-[10px] font-mono text-stone-500 flex-shrink-0">
            ${p.type === 'review' ? `<button type="button" onclick="openExportCardModalFromPost('${_pmEsc(p.id)}')" class="hover:text-rose-700 dark:hover:text-rose-400 transition cursor-pointer flex items-center gap-1 text-rose-800 dark:text-rose-400" title="Exportar tarjeta editorial"><i class="fa-solid fa-share-nodes"></i>Tarjeta</button>` : ''}
            ${p.mine ? `<button type="button" data-act="edit" class="hover:text-stone-900 dark:hover:text-stone-200 transition cursor-pointer"><i class="fa-solid fa-pen mr-1"></i>Editar</button>
            <button type="button" data-act="delete" class="hover:text-rose-600 transition cursor-pointer"><i class="fa-solid fa-trash mr-1"></i>Borrar</button>` : ''}
        </div>`;
}

function renderPostReactions(p) {
    const el = document.getElementById('pmReactions');
    if (!el) return;
    const agOn = p.myVote === 'agree';
    const dgOn = p.myVote === 'disagree';
    el.innerHTML = `
        <button type="button" data-act="vote" data-type="agree" class="inline-flex items-center gap-1.5 transition cursor-pointer ${agOn ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'}"><i class="${agOn ? 'fa-solid' : 'fa-regular'} fa-thumbs-up"></i><span>Acuerdo (${p.reactions.agree})</span></button>
        <button type="button" data-act="vote" data-type="disagree" class="inline-flex items-center gap-1.5 transition cursor-pointer ${dgOn ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'}"><i class="${dgOn ? 'fa-solid' : 'fa-regular'} fa-thumbs-down"></i><span>Discrepo (${p.reactions.disagree})</span></button>`;
}

function formatCommentText(text) {
    return _pmEsc(text).replace(/(@[A-Za-z0-9_ÁÉÍÓÚáéíóúÑñ]+)/g, '<span class="text-rose-800 dark:text-rose-400 font-bold">$1</span>');
}

function renderSingleCommentBlock(postId, c, post) {
    const isSynthetic = String(c.id || '').startsWith('lc_');
    const canDelete = !isSynthetic && (c.mine || (post && post.mine));
    const actions = !isSynthetic ? `
        ${c.mine ? `<button type="button" data-act="cedit" data-cid="${_pmEsc(c.id)}" class="text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"><i class="fa-solid fa-pen mr-0.5"></i>Editar</button>` : ''}
        ${canDelete ? `<button type="button" data-act="cdel" data-cid="${_pmEsc(c.id)}" class="text-rose-800 hover:text-rose-600 cursor-pointer"><i class="fa-solid fa-trash mr-0.5"></i>Borrar</button>` : ''}` : '';
    return `
        <div id="commentRow_${_pmEsc(c.id)}" class="cz-comment p-2.5 text-xs">
            <div class="flex items-start gap-2.5">
                <button type="button" data-act="user" data-uid="${_pmEsc(c.authorUid)}" data-uname="${_pmEsc(c.author)}" data-useed="${_pmEsc(c.avatarSeed)}" aria-label="Ver perfil de ${_pmEsc(c.author)}"><img src="${_avatarOf(c.avatarSeed, c.author)}" alt="" class="w-6 h-6 rounded-full cz-avatar flex-shrink-0 mt-0.5 hover:opacity-80 transition"></button>
                <div class="space-y-1 flex-grow min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <button type="button" data-act="user" data-uid="${_pmEsc(c.authorUid)}" data-uname="${_pmEsc(c.author)}" data-useed="${_pmEsc(c.avatarSeed)}" class="font-heading font-bold hover:underline truncate text-left">${_pmEsc(c.author)}</button>
                        <span class="text-[9px] font-mono text-stone-400 flex-shrink-0">${_pmEsc(c.date)}</span>
                    </div>
                    <p id="commentText_${_pmEsc(c.id)}" class="font-serif text-stone-700 dark:text-stone-300 leading-relaxed" style="white-space:pre-wrap;overflow-wrap:anywhere">${formatCommentText(c.text)}</p>
                    <div class="flex items-center justify-between pt-1 border-t border-stone-300/40 dark:border-stone-800/60">
                        <div class="flex items-center gap-2 text-[10px] font-mono">
                            <button type="button" data-act="reply" data-cid="${_pmEsc(c.parentId || c.id)}" data-author-of="${_pmEsc(c.id)}" class="text-rose-800 dark:text-rose-400 font-bold hover:underline cursor-pointer"><i class="fa-solid fa-reply mr-1"></i>Responder</button>
                            ${actions}
                        </div>
                        ${!isSynthetic ? `<div class="flex items-center gap-1.5 text-[10px] font-mono ml-auto">
                            <button type="button" data-act="cvote" data-type="agree" data-cid="${_pmEsc(c.id)}" class="cz-vote-sm ${c.myVote === 'agree' ? 'cz-vote-on-agree' : ''}" title="Acuerdo"><i class="fa-solid fa-thumbs-up text-emerald-600 text-[9px]"></i><span>${c.reactions.agree}</span></button>
                            <button type="button" data-act="cvote" data-type="disagree" data-cid="${_pmEsc(c.id)}" class="cz-vote-sm ${c.myVote === 'disagree' ? 'cz-vote-on-disagree' : ''}" title="Discrepo"><i class="fa-solid fa-thumbs-down text-rose-600 text-[9px]"></i><span>${c.reactions.disagree}</span></button>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
}

function renderCommentsTreeHtml(postId, comments, post) {
    if (!comments.length) {
        return `<div class="text-center py-3 text-stone-500 dark:text-stone-400 text-[11px] font-serif italic">Aún no hay comentarios en este debate. ¡Sé el primero en aportar!</div>`;
    }
    const ids = new Set(comments.map(c => c.id));
    const mains = comments.filter(c => !c.parentId || !ids.has(c.parentId));
    let html = '';
    mains.forEach(c => {
        html += renderSingleCommentBlock(postId, c, post);
        const replies = comments.filter(r => r.parentId === c.id);
        if (replies.length) {
            html += `<div class="ml-6 border-l-2 border-rose-900/40 pl-3 space-y-2 mt-2">${replies.map(r => renderSingleCommentBlock(postId, r, post)).join('')}</div>`;
        }
    });
    return html;
}

function _getEffectiveComments(post) {
    const sub = Array.isArray(window.muralComments) ? window.muralComments : [];
    const emb = (post && Array.isArray(post.comments)) ? post.comments : [];
    const seen = new Set();
    const merged = [];
    [...sub, ...emb].forEach((c, idx) => {
        if (!c || !c.text) return;
        const id = c.id || `emb_${idx}`;
        const sig = `${c.author || ''}|${c.text}`;
        if (seen.has(id) || seen.has(sig)) return;
        seen.add(id);
        seen.add(sig);
        merged.push(normComment({ ...c, id }));
    });
    if (!merged.length && post && post.lastComment && post.lastComment.text) {
        const lc = post.lastComment;
        merged.push(normComment({
            id: `lc_${post.id}`,
            author: lc.author || 'Usuario',
            authorUid: lc.authorUid || '',
            avatarSeed: lc.avatarSeed || lc.author || 'Usuario',
            text: lc.text,
            createdAt: lc.createdAt || post.updatedAt || post.createdAt,
            votes: lc.votes || {}
        }));
    }
    return merged;
}

function renderComments(post) {
    const list = document.getElementById('pmComments');
    if (!list) return;
    const comments = _getEffectiveComments(post);
    const top = list.scrollTop;
    list.innerHTML = renderCommentsTreeHtml(post.id, comments, post);
    list.scrollTop = top;
    const t = document.getElementById('pmCommentsTitle');
    if (t) t.textContent = `NOTAS AL MARGEN (${comments.length})`;
}

function refreshPostModal() {
    const modal = document.getElementById('muralPostModal');
    if (!modal || modal.classList.contains('hidden') || !window._openPostId) return;
    const post = findPost(window._openPostId);
    if (!post) { closeMuralPostModal(); showToast('Esa publicación ya no existe.', 'info'); return; }
    renderPostReactions(post);
    renderPostAuthor(post);
    if (!window._editingPost) renderPostBody(post);
    if (!window._editingComment) renderComments(post);
}

function _muralModalClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, pid = window._openPostId, cid = el.dataset.cid;
    switch (act) {
        case 'close': closeMuralPostModal(); break;
        case 'vote': reactToMuralPost(pid, el.dataset.type); break;
        case 'user': openUserProfileModal(el.dataset.uid, el.dataset.uname, el.dataset.useed); break;
        case 'movie': openRegisteredMovie(Number(el.dataset.reg)); break;
        case 'edit': enableEditMuralPost(pid); break;
        case 'delete': deleteMuralPost(pid); break;
        case 'pcancel': window._editingPost = false; refreshPostModal(); break;
        case 'psave': saveEditedMuralPost(pid); break;
        case 'stars0': if (window._editSet) window._editSet(0); break;
        case 'reply': setReplyTarget(pid, cid, el.dataset.authorOf); break;
        case 'clearReply': clearReplyTarget(pid); break;
        case 'cedit': enableEditComment(pid, cid); break;
        case 'ccancel': window._editingComment = null; refreshPostModal(); break;
        case 'csave': saveEditedComment(pid, cid); break;
        case 'cdel': deleteMuralComment(pid, cid); break;
        case 'cvote': reactToComment(pid, cid, el.dataset.type); break;
        case 'send': submitMuralComment(pid); break;
    }
}

async function openMuralPostModal(postId, highlightCommentId) {
    let post = findPost(postId);
    if (!post && window.fbGetPost) {
        const raw = await window.fbGetPost(postId);
        if (raw) { window._extraPosts[postId] = raw; post = normPost(raw); }
    }
    if (!post) { showToast('No se encontró esa publicación.', 'info'); return; }
    await _ensureViewerMovie(post);
    post = findPost(postId) || normPost(post);

    resetModalPosition('muralPostModal');
    let modal = document.getElementById('muralPostModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'muralPostModal';
        modal.className = 'fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[120] hidden flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    window._openPostId = postId;
    window._editingPost = false;
    window._editingComment = null;

    modal.innerHTML = `
        <div class="bg-stone-50 dark:bg-[#1a1816] journal-border rounded-none max-w-lg w-full p-0 text-left relative shadow-2xl draggable-modal-content flex flex-col">
            <div id="muralPostHeader" class="modal-header-drag flex items-center justify-between border-b border-stone-200 dark:border-stone-800 px-5 py-2.5 bg-stone-100/80 dark:bg-[#141312] flex-shrink-0">
                <span class="text-[10px] font-mono text-stone-600 dark:text-stone-300 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-grip-lines text-stone-400"></i> CINEZINE — ARTÍCULO</span>
                <button type="button" data-act="close" aria-label="Cerrar" class="text-stone-400 hover:text-stone-800 dark:hover:text-white text-base p-0.5 transition cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="px-5 pt-3.5 pb-3 space-y-3.5 flex-shrink-0">
                <div id="pmAuthor" class="flex items-center justify-between gap-3"></div>
                <div id="pmBody" class="space-y-3"></div>
                <div id="pmReactions" class="flex items-center gap-4 pt-2.5 border-t border-stone-200 dark:border-stone-800/80 text-[11px] font-mono"></div>
            </div>
            <div class="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-[#141312] space-y-2 flex-grow flex flex-col min-h-0">
                <h4 class="font-heading font-bold text-[11px] uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5 flex-shrink-0">
                    <i class="fa-solid fa-comments text-rose-700 dark:text-rose-500"></i>
                    <span id="pmCommentsTitle">NOTAS AL MARGEN (0)</span>
                </h4>
                <div id="pmComments" class="space-y-2 flex-grow overflow-y-auto custom-scrollbar pr-1 min-h-[44px]"></div>
                <div class="space-y-1 pt-0.5 flex-shrink-0">
                    <div id="replyIndicator_${postId}" class="text-[10px] font-mono text-stone-500 hidden"></div>
                    <div class="flex items-center gap-2 relative border-b border-stone-300 dark:border-stone-800 focus-within:border-rose-800 pb-1">
                        <input type="text" maxlength="1000" id="newCommentInput_${postId}" placeholder="Escribe tu apunte..." class="bg-transparent flex-grow px-1 py-0.5 text-xs font-serif text-stone-800 dark:text-stone-200 placeholder-stone-500 focus:outline-none">
                        <button type="button" id="emojiBtn_newCommentInput_${postId}" onclick="toggleEmojiPicker('newCommentInput_${postId}')" aria-label="Añadir emoji" class="px-1 py-0.5 text-xs hover:opacity-80 transition cursor-pointer">🎬</button>
                        <button type="button" data-act="send" class="px-3 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-rose-900 hover:text-white dark:hover:bg-rose-900 text-stone-700 dark:text-stone-200 font-mono text-[10px] font-bold transition uppercase tracking-wider cursor-pointer">Enviar</button>
                    </div>
                </div>
            </div>
        </div>`;
    modal.onclick = (e) => { if (e.target === modal) closeMuralPostModal(); else _muralModalClick(e); };
    const input = document.getElementById(`newCommentInput_${postId}`);
    if (input) input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submitMuralComment(postId); });

    makeModalDraggable('muralPostModal', 'muralPostHeader');
    modal.classList.remove('hidden');
    renderPostAuthor(post); renderPostBody(post); renderPostReactions(post); renderComments(post);
    let _didHighlight = false;
    window.fbWatchComments(postId, () => {
        refreshPostModal();
        if (highlightCommentId && !_didHighlight) {
            const row = document.getElementById(`commentRow_${highlightCommentId}`);
            if (row) {
                _didHighlight = true;
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('ring-2', 'ring-rose-700');
                setTimeout(() => row.classList.remove('ring-2', 'ring-rose-700'), 2600);
            }
        }
    });
}

function closeMuralPostModal() {
    const modal = document.getElementById('muralPostModal');
    if (modal) modal.classList.add('hidden');
    window._openPostId = null;
    window._editingPost = false;
    window._editingComment = null;
    if (window.fbStopComments) window.fbStopComments();
}

async function _afterPostWrite(postId) {
    if (window._extraPosts[postId] && window.fbGetPost) {
        const raw = await window.fbGetPost(postId);
        if (raw) window._extraPosts[postId] = raw; else delete window._extraPosts[postId];
    }
    refreshPostModal();
    renderMuralFeed();
}

// ----- Votos -----
async function reactToMuralPost(postId, type) {
    if (!requireAuth('Inicia sesión para reaccionar.')) return;
    const post = findPost(postId);
    if (!post) return;
    try {
        const nextType = post.myVote === type ? null : type;
        await window.fbVotePost(postId, nextType, {
            recipientUid: post.authorUid || '',
            postLabel: _notifPostTitle(post)
        });
        await _afterPostWrite(postId);
    } catch (err) { handleWriteError(err, 'reaccionar'); }
}

async function reactToComment(postId, commentId, type) {
    if (!requireAuth('Inicia sesión para reaccionar.')) return;
    const c = (window.muralComments || []).map(normComment).find(x => x.id === commentId);
    if (!c) return;
    const post = findPost(postId);
    const nextType = c.myVote === type ? null : type;
    try {
        await window.fbVoteComment(postId, commentId, nextType, {
            recipientUid: c.authorUid || '',
            postLabel: post ? _notifPostTitle(post) : 'una publicación',
            commentText: c.text || ''
        });
    }
    catch (err) { handleWriteError(err, 'reaccionar'); }
}

// ----- Comentarios -----
function setReplyTarget(postId, parentCommentId, repliedCommentId) {
    const target = (window.muralComments || []).find(c => c.id === repliedCommentId);
    const author = target ? (target.author || 'Usuario') : 'Usuario';
    const authorUid = target ? (target.authorUid || '') : '';
    replyingTargetMap[postId] = { commentId: parentCommentId, author, authorUid };
    const input = document.getElementById(`newCommentInput_${postId}`);
    const indicator = document.getElementById(`replyIndicator_${postId}`);
    if (input) { input.value = `@${author} `; input.focus(); }
    if (indicator) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = 'Respondiendo a <strong></strong> <button type="button" data-act="clearReply" aria-label="Cancelar respuesta" class="ml-1 text-rose-800 hover:underline"><i class="fa-solid fa-xmark"></i></button>';
        indicator.querySelector('strong').textContent = '@' + author;
    }
}

function clearReplyTarget(postId) {
    delete replyingTargetMap[postId];
    const input = document.getElementById(`newCommentInput_${postId}`);
    const indicator = document.getElementById(`replyIndicator_${postId}`);
    if (input) {
        if (input.value.startsWith('@')) input.value = '';
        input.placeholder = 'Escribe tu apunte...';
    }
    if (indicator) indicator.classList.add('hidden');
}

async function submitMuralComment(postId) {
    if (!requireAuth('Inicia sesión para comentar.')) return;
    const input = document.getElementById(`newCommentInput_${postId}`);
    if (!input) return;
    let text = input.value.trim();
    if (!text) return;
    const t = replyingTargetMap[postId];
    if (t && !text.startsWith('@' + t.author)) text = `@${t.author} ${text}`;
    if (text.length > 1000) { showToast('El comentario es demasiado largo (máx. 1000 caracteres).', 'error'); return; }
    const post = findPost(postId);
    const parentComment = t && t.commentId ? (window.muralComments || []).find(c => c.id === t.commentId) : null;
    const parentAuthorUid = (t && t.authorUid) || (parentComment && parentComment.authorUid) || '';
    input.disabled = true;
    try {
        await window.fbAddComment(postId, {
            text, parentId: t ? t.commentId : null, replyToAuthor: t ? t.author : null,
            author: _myName(), avatarSeed: currentAvatarSeed,
            postAuthorUid: post ? (post.authorUid || '') : '',
            parentAuthorUid,
            postLabel: post ? _notifPostTitle(post) : 'una publicación'
        });
        input.value = '';
        clearReplyTarget(postId);
        await _afterPostWrite(postId);
    } catch (err) { handleWriteError(err, 'comentar'); }
    finally { input.disabled = false; input.focus(); }
}

function deleteMuralComment(postId, commentId) {
    showDeleteConfirmationModal(async () => {
        try {
            const rest = (window.muralComments || []).filter(c => c.id !== commentId).sort((a, b) => _ms(a.createdAt) - _ms(b.createdAt));
            const last = rest.length ? rest[rest.length - 1] : null;
            await window.fbDeleteComment(postId, commentId, last ? { author: last.author, avatarSeed: last.avatarSeed, text: String(last.text).slice(0, 160) } : null);
            await _afterPostWrite(postId);
        } catch (err) { handleWriteError(err, 'borrar el comentario'); }
    });
}

function enableEditComment(postId, commentId) {
    const textEl = document.getElementById(`commentText_${commentId}`);
    const c = (window.muralComments || []).find(x => x.id === commentId);
    if (!textEl || !c) return;
    window._editingComment = commentId;
    textEl.innerHTML = `
        <span class="flex items-center gap-2 pt-1 relative">
            <input type="text" maxlength="1000" id="editCommentInput_${_pmEsc(commentId)}" class="cz-input flex-grow px-2 py-1 text-xs font-serif">
            <button type="button" id="emojiBtn_editCommentInput_${_pmEsc(commentId)}" onclick="toggleEmojiPicker('editCommentInput_${_pmEsc(commentId)}')" aria-label="Añadir emoji" class="px-2 py-1 bg-stone-200 dark:bg-stone-800 text-xs journal-border">🎬</button>
            <button type="button" data-act="csave" data-cid="${_pmEsc(commentId)}" class="px-2.5 py-1 bg-rose-900 text-stone-100 text-[10px] font-mono journal-border">Guardar</button>
            <button type="button" data-act="ccancel" class="px-2 py-1 text-[10px] font-mono text-stone-500 hover:text-stone-900 dark:hover:text-white">Cancelar</button>
        </span>`;
    const input = document.getElementById(`editCommentInput_${commentId}`);
    input.value = c.text;
    input.focus();
}

async function saveEditedComment(postId, commentId) {
    const input = document.getElementById(`editCommentInput_${commentId}`);
    if (!input || !input.value.trim()) return;
    try {
        await window.fbEditComment(postId, commentId, input.value.trim().slice(0, 1000));
        window._editingComment = null;
        refreshPostModal();
    } catch (err) { handleWriteError(err, 'editar el comentario'); }
}

// ----- Editar / borrar publicación -----
function enableEditMuralPost(postId) {
    const post = findPost(postId);
    const body = document.getElementById('pmBody');
    if (!post || !post.mine || !body) return;
    window._editingPost = true;
    const isReview = post.type === 'review';
    body.innerHTML = `
        <div class="space-y-3 bg-stone-100 dark:bg-stone-950 p-3 journal-border">
            <span class="text-[10px] font-mono uppercase tracking-wider text-rose-800 dark:text-rose-400 font-bold">Editando publicación</span>
            <div class="space-y-1">
                <label for="pmEditTitle" class="text-[10px] font-mono text-stone-500 uppercase">${isReview ? 'Titular (opcional)' : 'Título del debate'}</label>
                <input type="text" id="pmEditTitle" maxlength="150" class="cz-input w-full px-2 py-1.5 text-xs font-heading font-bold">
            </div>
            ${isReview ? `<div class="space-y-1">
                <span class="text-[10px] font-mono text-stone-500 uppercase">Calificación (admite medias estrellas)</span>
                <div class="flex items-center gap-2 flex-wrap"><div id="pmEditStars" class="flex items-center"></div><span id="pmEditStarText" class="font-mono text-xs text-amber-600 w-16"></span><button type="button" data-act="stars0" class="text-[10px] font-mono text-stone-400 hover:text-rose-700 underline">Quitar</button></div>
            </div>` : ''}
            <div class="space-y-1">
                <label for="pmEditContent" class="text-[10px] font-mono text-stone-500 uppercase">Contenido</label>
                <textarea id="pmEditContent" rows="5" maxlength="5000" class="cz-input w-full p-2 text-xs font-serif"></textarea>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1 font-mono text-xs">
                <button type="button" data-act="pcancel" class="px-3 py-1 bg-stone-300 dark:bg-stone-800 text-stone-700 dark:text-stone-300 journal-border transition cursor-pointer">Cancelar</button>
                <button type="button" data-act="psave" class="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-stone-100 journal-border transition font-bold cursor-pointer">Guardar cambios</button>
            </div>
        </div>`;
    document.getElementById('pmEditTitle').value = isReview ? (post.reviewTitle || '') : (post.title || '');
    document.getElementById('pmEditContent').value = post.content || '';
    if (isReview) {
        window._editRating = post.rating != null ? Number(post.rating) : 0;
        window._editSet = mountStars('pmEditStars', 'pmEditStarText', window._editRating, v => { window._editRating = v; });
    }
}

async function saveEditedMuralPost(postId) {
    const post = findPost(postId);
    const content = (document.getElementById('pmEditContent') || {}).value;
    const title = ((document.getElementById('pmEditTitle') || {}).value || '').trim();
    if (!post || !post.mine || content === undefined) return;
    if (!content.trim()) { showToast('El contenido no puede estar vacío.', 'error'); return; }
    if (post.type === 'discussion' && !title) { showToast('El debate necesita un título.', 'error'); return; }
    const isReview = post.type === 'review';
    const rating = window._editRating > 0 ? window._editRating : null;
    const fields = isReview
        ? { reviewTitle: title, content: content.trim(), rating, author: _myName(), avatarSeed: currentAvatarSeed }
        : { title, content: content.trim(), author: _myName(), avatarSeed: currentAvatarSeed };
    try {
        await window.fbUpdatePost(postId, fields);
        if (isReview && postId.startsWith('r_') && personalReviews[post.tmdbMovieId]) {
            Object.assign(personalReviews[post.tmdbMovieId], { review: content.trim(), reviewTitle: title, rating, updatedAt: Date.now() });
            localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));
        }
        window._editingPost = false;
        await _afterPostWrite(postId);
        showToast('Cambios guardados ✓', 'ok');
    } catch (err) { handleWriteError(err, 'guardar los cambios'); }
}

function deleteMuralPost(postId) {
    const post = findPost(postId);
    if (!post || !post.mine) return;
    showDeleteConfirmationModal(async () => {
        try {
            await window.fbDeletePost(postId);
            const mid = post.tmdbMovieId || (post.movieObj && post.movieObj.id);
            if (mid && personalReviews[mid]) {
                delete personalReviews[mid];
                localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));
                updateProfileDrawerStats();
                renderResultsGrid();
            }
            delete window._extraPosts[postId];
            closeMuralPostModal();
            renderMuralFeed();
            showToast('Publicación eliminada.', 'ok');
        } catch (err) { handleWriteError(err, 'eliminar la publicación'); }
    }, 'Eliminar publicación', 'Se borrará la publicación y todos sus comentarios. Esta acción no se puede deshacer.');
}

// ----- Ficha de usuario (datos reales) -----
function closeUserProfileModal() {
    const m = document.getElementById('userProfileModal');
    if (m) m.classList.add('hidden');
}

async function openUserProfileModal(uid, fallbackName, fallbackSeed) {
    if (!uid && !fallbackName) { showToast('Esta publicación es antigua y no tiene ficha de autor.', 'info'); return; }
    let modal = document.getElementById('userProfileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'userProfileModal';
        modal.className = 'fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[150] hidden flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }
    modal.onclick = (e) => {
        if (e.target === modal) { closeUserProfileModal(); return; }
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const a = el.dataset.act;
        if (a === 'close') closeUserProfileModal();
        else if (a === 'post') { closeUserProfileModal(); openMuralPostModal(el.dataset.pid); }
        else if (a === 'mywatched') { closeUserProfileModal(); openWatchedMoviesModal(true); }
        else if (a === 'mynotes') { closeUserProfileModal(); openPersonalNotesModal(true); }
        else if (a === 'mylists') { closeUserProfileModal(); openCustomListsModal(true); }
    };
    const wrap = (inner) => `<div class="bg-stone-50 dark:bg-stone-900 journal-border rounded-none max-w-sm w-full p-6 space-y-4 text-center relative shadow-2xl z-[155]">
        <button type="button" data-act="close" aria-label="Cerrar" class="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-white text-base transition"><i class="fa-solid fa-xmark"></i></button>${inner}</div>`;
    modal.innerHTML = wrap(`<div class="py-10 text-xs font-mono text-stone-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando ficha...</div>`);
    modal.classList.remove('hidden');

    const isMe = (!!window.currentUser && !!uid && window.currentUser.uid === uid) ||
        (!uid && !!fallbackName && String(currentUsername || '').toLowerCase() === String(fallbackName).toLowerCase());
    const [prof, rawPosts] = await Promise.all([
        (!isMe && uid && window.fbGetProfile) ? window.fbGetProfile(uid) : null,
        (uid && window.fbGetUserPosts) ? window.fbGetUserPosts(uid) : []
    ]);
    if (modal.classList.contains('hidden')) return;

    const targetNameLower = String((prof && prof.username) || fallbackName || '').trim().toLowerCase();
    const muralMatches = getCommunityAndUserPosts().filter(p =>
        (uid && p.authorUid === uid) || (targetNameLower && String(p.author || '').trim().toLowerCase() === targetNameLower)
    );
    (rawPosts || []).forEach(r => { if (r && r.id) window._extraPosts[r.id] = r; });
    const byId = new Map();
    [...muralMatches, ...(rawPosts || []).map(normPost)].forEach(p => { if (p && p.id && !byId.has(p.id)) byId.set(p.id, p); });
    const posts = [...byId.values()].sort((a, b) => b.ms - a.ms);

    const first = posts[0];
    const name = isMe ? currentUsername : ((prof && prof.username) || (first && first.author) || fallbackName || 'Usuario');
    const seed = isMe ? currentAvatarSeed : ((prof && prof.avatarSeed) || (first && first.avatarSeed) || fallbackSeed || name);
    const bio = isMe ? currentUserBio : ((prof && prof.bio) || '');
    const avatar = isMe ? getAvatarUrl() : _avatarOf(seed, name);

    if (isMe) prunePersonalReviews();
    let vCount = watchedMovies.length, nCount = countValidPersonalReviews(personalReviews), lCount = customLists.length;
    if (isMe) {
        window._viewedUserLib = null;
    } else {
        const parseJson = (raw, def) => { try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : def; } catch (e) { return def; } };
        const libRaw = (prof && prof.library) || {};
        const normId = (v) => {
            if (typeof v === 'string' && v.startsWith('tv_')) return v;
            const n = Number(v);
            return n || 0;
        };
        const uWatchedSet = new Set(parseJson(libRaw.cine_watched_movies, []).map(normId).filter(Boolean));
        const uWatchedData = { ...parseJson(libRaw.cine_watched_movies_data, {}) };
        const uReviewsAll = parseJson(libRaw.cine_personal_reviews, {});
        const uReviews = {};
        Object.keys(uReviewsAll).forEach(k => {
            const rv = uReviewsAll[k];
            if (rv && rv.isPublic !== false) uReviews[k] = { ...rv };
        });
        posts.filter(p => p.type === 'review').forEach(p => {
            const mid = normId(p.tmdbMovieId || (p.movieObj && p.movieObj.id) || 0);
            if (!mid) return;
            const parsedMid = _parseMediaId(mid);
            if ((p.rating > 0 || !String(p.id || '').startsWith('r_')) && libRaw.cine_watched_movies !== undefined) {
                uWatchedSet.add(parsedMid.baseId);
            }
            if (p.movieObj && !uWatchedData[mid]) uWatchedData[mid] = p.movieObj;
            if (!uReviews[mid]) {
                uReviews[mid] = {
                    movie: p.movieObj || { id: mid, title: (parsedMid.isTv ? 'Serie #' + parsedMid.tmdbId : 'Película #' + mid) },
                    rating: p.rating,
                    review: p.content,
                    reviewTitle: p.reviewTitle,
                    isPublic: true,
                    updatedAt: p.ms,
                    postId: p.id
                };
            } else if (!uReviews[mid].postId) {
                uReviews[mid].postId = p.id;
            }
        });
        Object.keys(uReviews).forEach(k => {
            const rv = uReviews[k];
            const mid = normId(k);
            if (rv && !rv.postId && mid && (rv.review || rv.reviewTitle || rv.rating)) {
                const synthId = `r_${uid || name}_${mid}`;
                if (!window._extraPosts[synthId]) {
                    window._extraPosts[synthId] = {
                        id: synthId,
                        type: 'review',
                        authorUid: uid || '',
                        author: name,
                        avatarSeed: seed,
                        tmdbMovieId: mid,
                        movieObj: rv.movie || uWatchedData[mid] || { id: mid, title: 'Obra #' + mid },
                        reviewTitle: rv.reviewTitle || '',
                        content: rv.review || '',
                        rating: rv.rating != null ? rv.rating : null,
                        createdAt: rv.createdAt || rv.updatedAt || Date.now(),
                        updatedAt: rv.updatedAt || Date.now()
                    };
                }
                rv.postId = synthId;
            }
        });
        const uWatched = [...uWatchedSet];
        const uLists = (parseJson(libRaw.cine_custom_lists, []) || []).filter(l => l && l.isPublic !== false);
        window._viewedUserLib = {
            isMe: false,
            uid: uid || '',
            name,
            watchedMovies: uWatched,
            watchedMoviesData: uWatchedData,
            personalReviews: uReviews,
            customLists: uLists
        };
        vCount = uWatched.length;
        nCount = Object.keys(uReviews).filter(id => { const n = uReviews[id]; return n && (n.review || n.reviewTitle || n.rating); }).length;
        lCount = uLists.length;
    }

    const tile = (n, label, color, act) => `<button type="button" data-act="${act}" class="cz-tile p-2 text-center cursor-pointer transition"><span class="block text-sm font-bold ${color}">${n}</span><span class="text-[9px] text-stone-500 uppercase">${label}</span></button>`;
    const tiles = tile(vCount, 'Vistas', 'text-amber-600', 'mywatched') +
        tile(nCount, 'Apuntes', 'text-rose-800 dark:text-rose-400', 'mynotes') +
        tile(lCount, 'Cuadernos', 'text-stone-700 dark:text-stone-300', 'mylists');

    const recent = posts.slice(0, 6).map(p => `
        <button type="button" data-act="post" data-pid="${_pmEsc(p.id)}" class="cz-tile w-full text-left p-2.5 flex items-center justify-between gap-2 cursor-pointer">
            <span class="min-w-0"><span class="block text-[10px] font-mono text-stone-500">${p.type === 'review' ? _pmEsc((p.movieObj && p.movieObj.title) || 'Reseña') : 'Debate'} · ${_pmEsc(p.date)}</span>
            <span class="block text-xs font-heading font-bold text-rose-900 dark:text-rose-300 truncate">${_pmEsc((p.type === 'review' ? p.reviewTitle : p.title) || p.content)}</span></span>
            <span class="text-[10px] font-mono text-stone-400 flex-shrink-0">Ver →</span>
        </button>`).join('');

    modal.innerHTML = wrap(`
        <div class="relative w-24 h-24 mx-auto mt-2"><img src="${_pmEsc(avatar)}" alt="" class="w-24 h-24 rounded-full cz-avatar shadow-md object-cover"></div>
        <div class="space-y-1">
            <h3 class="font-heading font-bold text-lg">${_pmEsc(name)}</h3>
            ${isMe ? '<span class="inline-block text-[10px] font-mono tracking-widest uppercase bg-rose-900/10 text-rose-800 dark:text-rose-400 journal-border px-2 py-0.5">Tu ficha</span>' : ''}
            ${bio ? `<p class="text-xs font-serif italic text-stone-600 dark:text-stone-400 pt-2 px-2 leading-relaxed" style="white-space:pre-wrap">${_pmEsc(bio)}</p>` : ''}
        </div>
        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 font-mono">${tiles}</div>
        <div class="text-left space-y-2">
            <h4 class="font-heading font-bold text-[11px] uppercase tracking-wider text-stone-500">Publicaciones recientes</h4>
            <div class="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">${recent || '<p class="text-xs font-serif italic text-stone-400 text-center py-3">Todavía no ha publicado nada.</p>'}</div>
        </div>
        <button type="button" data-act="close" class="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider">Cerrar ficha</button>`);
}

// ----- Estrellas reutilizables con soporte de medias estrellas (0.5) y teclado -----
function mountStars(containerId, textId, initial, onChange) {
    const c = document.getElementById(containerId);
    if (!c) return null;
    let val = Number(initial) || 0;
    const paint = (hover) => {
        const v = hover != null ? hover : val;
        c.querySelectorAll('i').forEach((ic, idx) => {
            const starNum = idx + 1;
            if (v >= starNum) ic.className = 'fa-solid fa-star text-amber-500';
            else if (v >= starNum - 0.5) ic.className = 'fa-solid fa-star-half-stroke text-amber-500';
            else ic.className = 'fa-regular fa-star text-stone-300 dark:text-stone-600';
        });
        c.setAttribute('aria-valuenow', String(val));
        const t = document.getElementById(textId);
        if (t) t.textContent = v ? `${_fmtRating(v)}/10` : 'Sin nota';
    };
    c.innerHTML = '';
    c.setAttribute('role', 'slider');
    c.setAttribute('aria-valuemin', '0');
    c.setAttribute('aria-valuemax', '10');
    c.setAttribute('aria-valuenow', String(val));
    c.setAttribute('aria-label', 'Calificación de 0 a 10 en pasos de 0.5 (usa flechas izquierda/derecha)');
    for (let i = 1; i <= 10; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'px-0.5 text-base leading-none transition-transform hover:scale-125 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500';
        b.setAttribute('aria-label', `${i} de 10 estrellas (flechas ajustan media estrella)`);
        b.innerHTML = '<i></i>';
        const pickVal = (e) => {
            if (!e || e.detail === 0) return i;
            const rect = b.getBoundingClientRect();
            return (e.clientX - rect.left) < rect.width / 2 ? i - 0.5 : i;
        };
        b.onmousemove = (e) => paint(pickVal(e));
        b.onfocus = () => paint();
        b.onclick = (e) => { val = pickVal(e); paint(); onChange(val); };
        b.onkeydown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                val = Math.min(10, Math.round((val + 0.5) * 2) / 2);
                paint();
                onChange(val);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                val = Math.max(0, Math.round((val - 0.5) * 2) / 2);
                paint();
                onChange(val);
            } else if (e.key === 'Home' || e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                val = 0;
                paint();
                onChange(val);
            } else if (e.key === 'End') {
                e.preventDefault();
                val = 10;
                paint();
                onChange(val);
            }
        };
        c.appendChild(b);
    }
    c.onmouseleave = () => paint();
    c.onfocusout = () => paint();
    paint();
    return (v) => { val = Number(v) || 0; paint(); onChange(val); };
}

function setSmartStars(v) { if (window._smartSet) window._smartSet(v); }

// ----- Publicar desde el muro (respeta privacidad y limpia estado al cerrar) -----
async function handleSmartPublishSubmit(e) {
    e.preventDefault();
    if (!requireAuth('Inicia sesión para publicar en el muro.')) return;

    const titleVal = document.getElementById('smartPostTitle').value.trim();
    const contentVal = document.getElementById('smartPostContent').value.trim();
    const ratingVal = parseFloat(document.getElementById('smartPostRating').value);
    const movieIdVal = document.getElementById('selectedTmdbMovieId').value;
    const publishToWall = document.getElementById('wallPublishCheck')?.checked ?? true;

    if (!contentVal) { showToast('Escribe algo antes de publicar.', 'error'); return; }
    if (contentVal.length > 5000) { showToast('El texto es demasiado largo (máx. 5000 caracteres).', 'error'); return; }

    const ratingClean = isNaN(ratingVal) || ratingVal <= 0 ? null : ratingVal;
    const post = { type: currentPublishMode, author: _myName(), avatarSeed: currentAvatarSeed, content: contentVal };

    if (currentPublishMode === 'review') {
        if (!movieIdVal || !cachedSelectedMovieObj) { showToast('Selecciona una película o serie del buscador para tu reseña.', 'error'); return; }
        const isTvId = String(movieIdVal).startsWith('tv_');
        post.tmdbMovieId = isTvId ? String(movieIdVal) : parseInt(movieIdVal);
        post.movieObj = slimMovie({ ...cachedSelectedMovieObj, id: post.tmdbMovieId });
        post.reviewTitle = titleVal.slice(0, 150);
        post.rating = ratingClean;
        post.title = '';
    } else {
        if (!titleVal) { showToast('El debate necesita un título.', 'error'); return; }
        post.title = titleVal.slice(0, 150);
        post.reviewTitle = '';
    }

    const submitBtn = e.submitter || document.querySelector('#smartPublishForm button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
        if (currentPublishMode === 'review') {
            const nowMs = Date.now();
            const prev = personalReviews[post.tmdbMovieId];
            personalReviews[post.tmdbMovieId] = {
                movie: post.movieObj,
                rating: ratingClean,
                review: contentVal,
                reviewTitle: post.reviewTitle,
                isPublic: publishToWall,
                createdAt: (prev && prev.createdAt) || nowMs,
                updatedAt: nowMs
            };
            localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));
            const parsedTarget = _parseMediaId(post.tmdbMovieId);
            ensureWatchedMovie(parsedTarget.baseId, cachedSelectedMovieObj);
            updateProfileDrawerStats();

            if (publishToWall) {
                await window.fbUpsertReviewPost(post.tmdbMovieId, post);
                showToast('Reseña publicada en el muro ✓', 'ok');
            } else {
                await window.fbRemoveReviewPost(post.tmdbMovieId);
                showToast('Guardada en tus apuntes privados ✓', 'ok');
            }
        } else {
            await window.fbCreatePost(post);
            showToast('Debate publicado en el muro ✓', 'ok');
        }
        clearModalMovieSelection();
        closeSmartPublishModal();
    } catch (err) { handleWriteError(err, 'publicar'); }
    finally { if (submitBtn) submitBtn.disabled = false; }
}

// ----- Migración única de publicaciones antiguas guardadas en este navegador -----
async function migrateLegacyMural() {
    if (!window.currentUser || window._legacyMigrated) return;
    window._legacyMigrated = true;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]'); } catch (e) { return; }
    const mine = saved.filter(p => p && p.author === currentUsername && String(p.id).startsWith('post_') && p.content);
    if (mine.length) {
        for (const p of mine) {
            try {
                await window.fbCreatePost({
                    type: p.type === 'review' ? 'review' : 'discussion',
                    author: _myName(), avatarSeed: currentAvatarSeed,
                    title: String(p.title || '').slice(0, 150), reviewTitle: String(p.reviewTitle || '').slice(0, 150),
                    content: String(p.content).slice(0, 5000),
                    rating: typeof p.rating === 'number' ? p.rating : null,
                    tmdbMovieId: p.tmdbMovieId || null,
                    movieObj: p.movieObj ? slimMovie(p.movieObj) : null
                });
            } catch (err) { console.warn('Migración del muro interrumpida:', err); window._legacyMigrated = false; return; }
        }
        showToast(`Se movieron ${mine.length} publicación(es) tuyas al muro compartido.`, 'ok');
    }
    localStorage.removeItem('cine_diario_mural_posts');
}

// ----- Aviso de correo sin verificar -----
window.maybeShowVerifyBanner = function (user) {
    let b = document.getElementById('verifyBanner');
    const needs = !!user && !user.emailVerified && (user.providerData || []).some(p => p.providerId === 'password');
    if (!needs) { if (b) b.remove(); return; }
    if (b || sessionStorage.getItem('cineVerifyDismissed') === '1') return;
    b = document.createElement('div');
    b.id = 'verifyBanner';
    b.className = 'fixed bottom-0 inset-x-0 z-[400] bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100 border-t border-amber-400 dark:border-amber-800 text-xs font-mono flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 py-2';
    b.innerHTML = `<span><i class="fa-solid fa-envelope-circle-check mr-1.5"></i>Verifica tu correo para proteger tu cuenta.</span>
        <button type="button" data-v="resend" class="underline font-bold">Reenviar enlace</button>
        <button type="button" data-v="check" class="underline font-bold">Ya lo verifiqué</button>
        <button type="button" data-v="close" aria-label="Cerrar aviso"><i class="fa-solid fa-xmark"></i></button>`;
    b.onclick = async (e) => {
        const v = e.target.closest('[data-v]');
        if (!v) return;
        try {
            if (v.dataset.v === 'resend') { await window.fbResendVerification(); showToast('Te enviamos otro enlace. Revisa tu bandeja (y el spam).', 'ok'); }
            else if (v.dataset.v === 'check') {
                const u = await window.fbRefreshUser();
                if (u && u.emailVerified) { showToast('¡Correo verificado!', 'ok'); b.remove(); }
                else showToast('Aún no aparece verificado. Abre el enlace del correo y vuelve a intentarlo.', 'info');
            } else { sessionStorage.setItem('cineVerifyDismissed', '1'); b.remove(); }
        } catch (err) { showToast('No se pudo completar la acción. Inténtalo más tarde.', 'error'); }
    };
    document.body.appendChild(b);
};

// ----- Recuperar contraseña -----
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnForgotPassword');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const email = (document.getElementById('authEmail') || {}).value;
        if (!email || !email.trim()) { showToast('Escribe tu correo en el campo de arriba y vuelve a pulsar.', 'info'); return; }
        try {
            await window.fbResetPassword(email.trim());
            showToast('Si ese correo tiene cuenta, recibirás un enlace para crear una contraseña nueva.', 'ok');
        } catch (err) { showToast('No se pudo enviar el correo. Revisa que la dirección sea válida.', 'error'); }
    });
});

// ----- Calidad de vida: Esc cierra el modal superior, etiquetas de accesibilidad -----
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.fixed.inset-0')]
        .filter(el => el.id && el.id !== 'authModal' && !el.classList.contains('hidden'))
        .sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0) - (parseInt(getComputedStyle(a).zIndex) || 0));
    const top = open[0];
    if (!top) return;
    if (top.id === 'muralPostModal') closeMuralPostModal();
    else if (top.id === 'smartPublishModal') closeSmartPublishModal();
    else if (top.id === 'exportCardModal') closeExportCardModal();
    else if (top.id === 'profileDrawerBackdrop') toggleProfileDrawer();
    else top.classList.add('hidden');
});

const _ICON_LABELS = { 'fa-xmark': 'Cerrar', 'fa-moon': 'Cambiar tema', 'fa-sun': 'Cambiar tema', 'fa-pen': 'Editar', 'fa-trash': 'Borrar', 'fa-plus': 'Añadir', 'fa-magnifying-glass': 'Buscar', 'fa-reply': 'Responder', 'fa-chevron-down': 'Abrir menú', 'fa-volume-high': 'Sonido', 'fa-volume-xmark': 'Sonido' };
function autoLabelButtons() {
    document.querySelectorAll('button:not([aria-label])').forEach(b => {
        if (b.textContent.trim()) return;
        const ic = b.querySelector('i[class*="fa-"]');
        if (!ic) return;
        const hit = Object.keys(_ICON_LABELS).find(k => ic.classList.contains(k));
        if (hit) b.setAttribute('aria-label', b.getAttribute('title') || _ICON_LABELS[hit]);
    });
    document.querySelectorAll('.fixed.inset-0[id]:not([role])').forEach(m => {
        if (/modal$/i.test(m.id)) { m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    autoLabelButtons();
    let t = null;
    new MutationObserver(() => {
        if (document.hidden) return;
        clearTimeout(t);
        t = setTimeout(autoLabelButtons, 600);
    }).observe(document.body, { childList: true, subtree: true });
    setInterval(() => {
        const viewMural = document.getElementById('mainViewMural');
        const muralVisible = viewMural && !viewMural.classList.contains('hidden');
        if (!document.hidden && muralVisible && window.muralReady && !window.muralError) renderMuralFeed();
    }, 60000);
});

// ===== SISTEMA DE NOTIFICACIONES (CAMPANITA DE AVISOS) =====
let _notifReadSet = new Set((() => {
    try { return JSON.parse(localStorage.getItem('cine_notif_read') || '[]'); } catch (e) { /* valor por defecto intencional */ return []; }
})());
let _notifItems = [];
let _notifFilter = 'all';
let _notifCommentsCache = new Map(); // postId -> { sig, comments }
let _notifActorMap = new Map();      // uid -> { username, avatarSeed }
let _notifKnownIds = new Set();
let _notifInitialUid = null;
let _notifBusy = false;
let _notifQueued = false;

function _applyNotifReadRaw(raw) {
    try {
        const arr = raw ? JSON.parse(raw) : [];
        _notifReadSet = new Set(Array.isArray(arr) ? arr : []);
        _updateNotifBadgeUI();
        renderNotificationsPanel();
    } catch (e) { /* valor por defecto intencional */ }
}

function _saveNotifReadSet() {
    const arr = Array.from(_notifReadSet).slice(-500);
    localStorage.setItem('cine_notif_read', JSON.stringify(arr));
}

function _notifPostTitle(rawPost) {
    if (!rawPost) return 'Publicación';
    if (rawPost.type === 'review') {
        const m = (typeof _resolveViewerMovie === 'function' ? _resolveViewerMovie(rawPost) : null) || rawPost.movieObj;
        if (m && m.title) return m.title;
        if (rawPost.reviewTitle) return rawPost.reviewTitle;
        return 'Reseña';
    }
    return rawPost.title || rawPost.reviewTitle || 'Debate';
}

async function _resolveNotifActor(uid, fallbackName, fallbackSeed) {
    if (fallbackName && fallbackName !== 'Anónimo' && fallbackName !== 'Usuario') {
        return { username: fallbackName, avatarSeed: fallbackSeed || fallbackName };
    }
    if (!uid) return { username: fallbackName || 'Cinéfilo/a', avatarSeed: fallbackSeed || 'Cinéfilo/a' };
    if (_notifActorMap.has(uid)) return _notifActorMap.get(uid);
    if (typeof window.fbGetPublicProfileLite === 'function') {
        const prof = await window.fbGetPublicProfileLite(uid);
        if (prof && prof.username) {
            _notifActorMap.set(uid, prof);
            return prof;
        }
    }
    const fb = { username: fallbackName || 'Cinéfilo/a', avatarSeed: fallbackSeed || uid };
    _notifActorMap.set(uid, fb);
    return fb;
}

window.onNotifCommentsSnapshot = function (postId, comments) {
    if (!postId || !Array.isArray(comments)) return;
    const rawPost = (window.muralPosts || []).find(p => p.id === postId);
    const sig = rawPost ? `${rawPost.commentCount || comments.length}|${rawPost.lastComment ? rawPost.lastComment.text : ''}` : `live_${comments.length}`;
    _notifCommentsCache.set(postId, { sig, comments });
    if (typeof window.refreshNotifications === 'function') window.refreshNotifications();
};

window.refreshNotifications = async function () {
    const user = window.currentUser;
    if (!user || _isUserUnverified(user)) {
        _notifItems = [];
        _notifInitialUid = null;
        _notifKnownIds.clear();
        _updateNotifBadgeUI();
        renderNotificationsPanel();
        return;
    }

    if (_notifBusy) {
        _notifQueued = true;
        return;
    }
    _notifBusy = true;

    try {
        const myUid = user.uid;
        const myNameLower = String(currentUsername || '').trim().toLowerCase();
        const posts = Array.isArray(window.muralPosts) ? window.muralPosts : [];

        // 1) Poblar mapa rápido de autores conocidos desde las publicaciones visibles
        posts.forEach(p => {
            const pUid = p.authorUid || p.userId;
            if (pUid && p.author) {
                _notifActorMap.set(pUid, { username: p.author, avatarSeed: p.avatarSeed || p.author });
            }
        });

        // 2) Obtener comentarios ÚNICAMENTE de MIS publicaciones con actividad (cero lecturas ajenas en segundo plano)
        const isPostMine = (p) => {
            const pUid = p.authorUid || p.userId || '';
            const pAuthorLower = String(p.author || '').trim().toLowerCase();
            return (pUid && pUid === myUid) || (!pUid && myNameLower && pAuthorLower === myNameLower);
        };
        const myPostsWithComments = posts.filter(p => isPostMine(p) && ((p.commentCount || 0) > 0 || (p.lastComment && p.lastComment.text)));
        await Promise.all(myPostsWithComments.map(async (p) => {
            const sig = `${p.commentCount || 0}|${p.lastComment ? p.lastComment.text : ''}`;
            const cached = _notifCommentsCache.get(p.id);
            if (cached && cached.sig === sig) return;
            if (typeof window.fbFetchPostComments === 'function') {
                const fetched = await window.fbFetchPostComments(p.id);
                _notifCommentsCache.set(p.id, { sig, comments: fetched });
            }
        }));

        // Poblar también autores conocidos desde los comentarios en caché
        _notifCommentsCache.forEach(({ comments }) => {
            (comments || []).forEach(c => {
                if (c && c.authorUid && c.author) {
                    _notifActorMap.set(c.authorUid, { username: c.author, avatarSeed: c.avatarSeed || c.author });
                }
            });
        });

        const built = [];
        const dedupKeys = new Set();

        // 3) Incorporar primero las notificaciones dedicadas de Firestore (notifications/{uid}/items) con timestamp exacto
        const remoteNotifs = Array.isArray(window.fbNotifications) ? window.fbNotifications : [];
        for (const rn of remoteNotifs) {
            if (!rn || !rn.id) continue;
            if (rn.read) _notifReadSet.add(rn.id);
            const actorName = rn.fromName || 'Cinéfilo/a';
            const actorSeed = rn.fromAvatarSeed || actorName;
            const postTitle = rn.postLabel || 'una publicación';
            let uiType = 'comment';
            let verb = 'comentó en';
            let postKind = '';
            if (rn.type === 'reply') {
                uiType = 'reply';
                verb = 'respondió a tu nota en';
            } else if (rn.type === 'vote') {
                const isDisagree = String(rn.text || '').includes('👎');
                uiType = isDisagree ? 'vote_disagree' : 'vote_agree';
                verb = isDisagree ? 'discrepa de tu publicación' : 'está de acuerdo con tu publicación';
            } else if (rn.type === 'comment_vote') {
                const isDisagree = String(rn.text || '').includes('👎');
                uiType = isDisagree ? 'vote_disagree' : 'vote_agree';
                verb = isDisagree ? 'discrepa de tu nota en' : 'está de acuerdo con tu nota en';
            }
            const dedupKey = `${uiType}|${rn.postId || ''}|${rn.commentId || ''}|${rn.fromUid || ''}`;
            dedupKeys.add(dedupKey);
            built.push({
                id: rn.id,
                remoteId: rn.id,
                type: uiType,
                postId: rn.postId || '',
                commentId: rn.commentId || null,
                actorUid: rn.fromUid || '',
                actorName,
                actorSeed,
                postTitle,
                postKind,
                verb,
                snippet: (rn.type === 'comment' || rn.type === 'reply') ? String(rn.text || '').slice(0, 140) : '',
                ts: _ms(rn.createdAt),
                plainSummary: `${actorName} ${verb} «${postTitle}»`
            });
        }

        // 4) Respaldo local sin lecturas extra para mis publicaciones (y comentarios ya abiertos en memoria)
        for (const p of posts) {
            const isMyPost = isPostMine(p);
            const postTitle = _notifPostTitle(p);
            const postKind = p.type === 'review' ? 'reseña de' : 'debate';

            // A) Votos en mis publicaciones
            if (isMyPost && p.votes && typeof p.votes === 'object') {
                const voterEntries = Object.entries(p.votes).filter(([vUid, vType]) => vUid !== myUid && (vType === 'agree' || vType === 'disagree'));
                for (const [voterUid, voteType] of voterEntries) {
                    const uiType = voteType === 'agree' ? 'vote_agree' : 'vote_disagree';
                    const dedupKey = `${uiType}|${p.id}||${voterUid}`;
                    if (dedupKeys.has(dedupKey)) continue;
                    const actor = await _resolveNotifActor(voterUid);
                    const id = `vp_${p.id}_${voterUid}_${voteType}`;
                    const verb = voteType === 'agree' ? 'está de acuerdo con' : 'discrepa de';
                    built.push({
                        id,
                        type: uiType,
                        postId: p.id,
                        commentId: null,
                        actorUid: voterUid,
                        actorName: actor.username,
                        actorSeed: actor.avatarSeed,
                        postTitle,
                        postKind,
                        verb: `${verb} tu ${postKind}`,
                        snippet: '',
                        ts: _ms(p.updatedAt || p.createdAt),
                        plainSummary: `${actor.username} ${verb} tu ${postKind} «${postTitle}»`
                    });
                }
            }

            // B) Comentarios, respuestas y votos en comentarios (de mis posts o posts ya abiertos en sesión)
            const cachedEntry = _notifCommentsCache.get(p.id);
            let comments = (cachedEntry && Array.isArray(cachedEntry.comments)) ? cachedEntry.comments : [];
            if (!comments.length && isMyPost && p.lastComment && p.lastComment.text) {
                comments = [{
                    id: `lc_${p.id}`,
                    authorUid: p.lastComment.authorUid || '',
                    author: p.lastComment.author || 'Cinéfilo/a',
                    avatarSeed: p.lastComment.avatarSeed || p.lastComment.author || 'Cinéfilo/a',
                    text: p.lastComment.text,
                    createdAt: p.lastComment.createdAt || p.updatedAt || p.createdAt,
                    votes: {}
                }];
            }

            const byId = new Map(comments.map(c => [c.id, c]));

            for (const c of comments) {
                if (!c || !c.text) continue;
                const cUid = c.authorUid || '';
                const cNameLower = String(c.author || '').trim().toLowerCase();
                const isMyComment = (cUid && cUid === myUid) || (!cUid && myNameLower && cNameLower === myNameLower);

                // Votos sobre un comentario mío
                if (isMyComment && c.votes && typeof c.votes === 'object') {
                    const cVoters = Object.entries(c.votes).filter(([vUid, vType]) => vUid !== myUid && (vType === 'agree' || vType === 'disagree'));
                    for (const [voterUid, voteType] of cVoters) {
                        const uiType = voteType === 'agree' ? 'vote_agree' : 'vote_disagree';
                        const dedupKey = `${uiType}|${p.id}|${c.id}|${voterUid}`;
                        if (dedupKeys.has(dedupKey)) continue;
                        const actor = await _resolveNotifActor(voterUid);
                        const id = `vc_${p.id}_${c.id}_${voterUid}_${voteType}`;
                        const verb = voteType === 'agree' ? 'está de acuerdo con' : 'discrepa de';
                        built.push({
                            id,
                            type: uiType,
                            postId: p.id,
                            commentId: c.id,
                            actorUid: voterUid,
                            actorName: actor.username,
                            actorSeed: actor.avatarSeed,
                            postTitle,
                            postKind: 'nota en',
                            verb: `${verb} tu nota en`,
                            snippet: String(c.text).slice(0, 120),
                            ts: _ms(c.updatedAt || c.createdAt),
                            plainSummary: `${actor.username} ${verb} tu nota en «${postTitle}»`
                        });
                    }
                }

                if (isMyComment) continue;

                // ¿Es respuesta a un comentario mío o me menciona?
                const parent = c.parentId ? byId.get(c.parentId) : null;
                const parentIsMine = parent && ((parent.authorUid && parent.authorUid === myUid) || (!parent.authorUid && myNameLower && String(parent.author || '').trim().toLowerCase() === myNameLower));
                const replyToMe = myNameLower && String(c.replyToAuthor || '').trim().toLowerCase() === myNameLower;
                const mentionsMe = myNameLower && myNameLower !== 'invitado/a' && String(c.text).toLowerCase().includes(`@${myNameLower}`);

                if (parentIsMine || replyToMe || mentionsMe) {
                    const dedupKey = `reply|${p.id}|${c.id}|${cUid}`;
                    if (dedupKeys.has(dedupKey)) continue;
                    const id = `rep_${p.id}_${c.id}`;
                    built.push({
                        id,
                        type: 'reply',
                        postId: p.id,
                        commentId: c.id,
                        actorUid: cUid,
                        actorName: c.author || 'Cinéfilo/a',
                        actorSeed: c.avatarSeed || c.author || 'Cinéfilo/a',
                        postTitle,
                        postKind: '',
                        verb: 'respondió a tu nota en',
                        snippet: String(c.text).slice(0, 140),
                        ts: _ms(c.createdAt),
                        plainSummary: `${c.author || 'Alguien'} respondió a tu nota en «${postTitle}»`
                    });
                } else if (isMyPost) {
                    const dedupKey = `comment|${p.id}|${c.id}|${cUid}`;
                    if (dedupKeys.has(dedupKey)) continue;
                    const id = `cmt_${p.id}_${c.id}`;
                    built.push({
                        id,
                        type: 'comment',
                        postId: p.id,
                        commentId: c.id,
                        actorUid: cUid,
                        actorName: c.author || 'Cinéfilo/a',
                        actorSeed: c.avatarSeed || c.author || 'Cinéfilo/a',
                        postTitle,
                        postKind,
                        verb: `comentó en tu ${postKind}`,
                        snippet: String(c.text).slice(0, 140),
                        ts: _ms(c.createdAt),
                        plainSummary: `${c.author || 'Alguien'} comentó en tu ${postKind} «${postTitle}»`
                    });
                }
            }
        }

        // Ordenar de más reciente a más antigua
        built.sort((a, b) => b.ts - a.ts);
        _notifItems = built;

        // Detectar avisos nuevos llegados en tiempo real
        if (_notifInitialUid !== myUid) {
            _notifInitialUid = myUid;
            _notifKnownIds = new Set(built.map(n => n.id));
        } else {
            const newlyArrived = built.filter(n => !_notifKnownIds.has(n.id) && !_notifReadSet.has(n.id));
            built.forEach(n => _notifKnownIds.add(n.id));
            if (newlyArrived.length > 0) {
                showToast(`🔔 ${newlyArrived[0].plainSummary}`, 'info');
                const bellIcon = document.getElementById('notifBellIcon');
                if (bellIcon) {
                    bellIcon.classList.add('animate-bounce');
                    setTimeout(() => bellIcon.classList.remove('animate-bounce'), 1800);
                }
            }
        }

        _updateNotifBadgeUI();
        renderNotificationsPanel();
    } finally {
        _notifBusy = false;
        if (_notifQueued) {
            _notifQueued = false;
            window.refreshNotifications();
        }
    }
};

function _updateNotifBadgeUI() {
    const badge = document.getElementById('notifBadge');
    const icon = document.getElementById('notifBellIcon');
    if (!badge) return;
    const unread = _notifItems.filter(n => !_notifReadSet.has(n.id)).length;
    if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : String(unread);
        badge.classList.remove('hidden');
        if (icon) {
            icon.classList.remove('text-stone-700', 'dark:text-stone-300');
            icon.classList.add('text-rose-800', 'dark:text-rose-400');
        }
    } else {
        badge.classList.add('hidden');
        if (icon) {
            icon.classList.remove('text-rose-800', 'dark:text-rose-400');
            icon.classList.add('text-stone-700', 'dark:text-stone-300');
        }
    }
}

function toggleNotificationsPanel(ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const willOpen = panel.classList.contains('hidden');
    if (willOpen) {
        renderNotificationsPanel();
        panel.classList.remove('hidden');
        if (typeof window.refreshNotifications === 'function') window.refreshNotifications();
    } else {
        panel.classList.add('hidden');
    }
}

function setNotifFilter(mode) {
    _notifFilter = mode === 'unread' ? 'unread' : 'all';
    const tabAll = document.getElementById('notifTabAll');
    const tabUnread = document.getElementById('notifTabUnread');
    const activeCls = 'flex-1 py-1.5 font-bold text-rose-800 dark:text-rose-400 border-b-2 border-rose-800 dark:border-rose-400 uppercase tracking-wider cursor-pointer';
    const idleCls = 'flex-1 py-1.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 border-b-2 border-transparent uppercase tracking-wider cursor-pointer';
    if (tabAll) tabAll.className = _notifFilter === 'all' ? activeCls : idleCls;
    if (tabUnread) tabUnread.className = _notifFilter === 'unread' ? activeCls : idleCls;
    renderNotificationsPanel();
}

function markAllNotificationsRead() {
    if (!_notifItems.length) return;
    const remoteIds = [];
    _notifItems.forEach(n => {
        _notifReadSet.add(n.id);
        if (n.remoteId) remoteIds.push(n.remoteId);
    });
    _saveNotifReadSet();
    if (window.currentUser && remoteIds.length && typeof window.fbMarkNotificationsRead === 'function') {
        window.fbMarkNotificationsRead(window.currentUser.uid, remoteIds);
    }
    _updateNotifBadgeUI();
    renderNotificationsPanel();
}

function openNotificationItem(idx) {
    const list = _notifFilter === 'unread' ? _notifItems.filter(n => !_notifReadSet.has(n.id)) : _notifItems;
    const item = list[idx];
    if (!item) return;
    _notifReadSet.add(item.id);
    _saveNotifReadSet();
    if (window.currentUser && item.remoteId && typeof window.fbMarkNotificationsRead === 'function') {
        window.fbMarkNotificationsRead(window.currentUser.uid, [item.remoteId]);
    }
    _updateNotifBadgeUI();
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.add('hidden');
    openMuralPostModal(item.postId, item.commentId || null);
}

function renderNotificationsPanel() {
    const listEl = document.getElementById('notifList');
    if (!listEl) return;

    const user = window.currentUser;
    if (!user || _isUserUnverified(user)) {
        listEl.innerHTML = `
            <div class="p-6 text-center space-y-2">
                <i class="fa-regular fa-bell text-2xl text-stone-400"></i>
                <p class="text-xs font-serif text-stone-600 dark:text-stone-400">Inicia sesión para recibir avisos cuando comenten o reaccionen a tus reseñas.</p>
            </div>`;
        return;
    }

    const items = _notifFilter === 'unread'
        ? _notifItems.filter(n => !_notifReadSet.has(n.id))
        : _notifItems;

    if (!items.length) {
        listEl.innerHTML = `
            <div class="p-6 text-center space-y-1.5">
                <i class="fa-regular fa-bell-slash text-xl text-stone-400"></i>
                <p class="text-xs font-serif italic text-stone-500 dark:text-stone-400">${_notifFilter === 'unread' ? 'No tienes avisos pendientes por leer.' : 'Aún no hay avisos de actividad en tus publicaciones.'}</p>
            </div>`;
        return;
    }

    const typeBadge = (type) => {
        if (type === 'new_post') return '<span class="w-4 h-4 rounded-full bg-stone-800 dark:bg-stone-700 text-amber-400 flex items-center justify-center text-[8px]"><i class="fa-solid fa-feather-pointed"></i></span>';
        if (type === 'reply') return '<span class="w-4 h-4 rounded-full bg-rose-800 text-white flex items-center justify-center text-[8px]"><i class="fa-solid fa-reply"></i></span>';
        if (type === 'comment') return '<span class="w-4 h-4 rounded-full bg-amber-700 text-white flex items-center justify-center text-[8px]"><i class="fa-solid fa-comment-dots"></i></span>';
        if (type === 'vote_agree') return '<span class="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[8px]"><i class="fa-solid fa-thumbs-up"></i></span>';
        return '<span class="w-4 h-4 rounded-full bg-rose-700 text-white flex items-center justify-center text-[8px]"><i class="fa-solid fa-thumbs-down"></i></span>';
    };

    listEl.innerHTML = items.map((n, idx) => {
        const unread = !_notifReadSet.has(n.id);
        return `
            <button type="button" onclick="openNotificationItem(${idx})" class="w-full text-left p-3 flex items-start gap-3 transition cursor-pointer ${unread ? 'bg-rose-950/[0.06] dark:bg-rose-950/20 hover:bg-rose-950/10 dark:hover:bg-rose-950/30' : 'hover:bg-stone-100 dark:hover:bg-stone-800/60'}">
                <div class="relative flex-shrink-0 mt-0.5">
                    <img src="${_avatarOf(n.actorSeed, n.actorName)}" alt="" class="w-8 h-8 rounded-full cz-avatar">
                    <div class="absolute -bottom-1 -right-1">${typeBadge(n.type)}</div>
                </div>
                <div class="flex-grow min-w-0 space-y-1">
                    <p class="text-xs font-serif text-stone-800 dark:text-stone-200 leading-snug">
                        <span class="font-heading font-bold">${_pmEsc(n.actorName)}</span>
                        ${_pmEsc(n.verb)}
                        <span class="font-bold text-rose-800 dark:text-rose-400">«${_pmEsc(n.postTitle)}»</span>
                    </p>
                    ${n.snippet ? `<p class="text-[11px] font-serif italic text-stone-600 dark:text-stone-400 line-clamp-2 border-l-2 border-stone-300 dark:border-stone-700 pl-2">“${_pmEsc(n.snippet)}”</p>` : ''}
                    <span class="block text-[9px] font-mono text-stone-400 uppercase tracking-wider">${_pmEsc(relTime(n.ts))}</span>
                </div>
                ${unread ? '<span class="w-2 h-2 rounded-full bg-rose-700 dark:bg-rose-500 flex-shrink-0 mt-1.5" title="Sin leer"></span>' : ''}
            </button>`;
    }).join('');
}

document.addEventListener('click', (e) => {
    const box = document.getElementById('notifBellContainer');
    const panel = document.getElementById('notifPanel');
    if (panel && !panel.classList.contains('hidden') && box && !box.contains(e.target)) {
        panel.classList.add('hidden');
    }
});
// ===== FIN SISTEMA DE NOTIFICACIONES =====
// ===== FIN MURO COMPARTIDO =====

// ===== VARIABLES GLOBALES Y ESTADO PRINCIPAL =====
const TMDB_PROXY_URL = window.CINE_TMDB_PROXY || (
    (typeof location !== 'undefined' && /\.vercel\.app$/i.test(location.hostname))
        ? '/api/tmdb'
        : 'https://cinezine.vercel.app/api/tmdb'
);
let _catalogInitialized = false;
let _oscarsInitialized = false;
let _rouletteSeeded = false;

let currentLang = localStorage.getItem('cine_lang') || "es-MX";
let currentTitleLang = localStorage.getItem('cine_title_lang') || "en-US";
let oscarMode = "WINNERS";
let moviesList = [];
let fetchedResults = [];
let currentFilterPage = 1;
let totalFilterPages = 1;
let currentOscarList = [];
let watchedMovies = JSON.parse(localStorage.getItem('cine_watched_movies') || '[]');
let watchedMoviesData = JSON.parse(localStorage.getItem('cine_watched_movies_data') || '{}');
let watchedEpisodes = JSON.parse(localStorage.getItem('cine_watched_episodes') || '{}');
let personalReviews = JSON.parse(localStorage.getItem('cine_personal_reviews') || '{}');
let customLists = JSON.parse(localStorage.getItem('cine_custom_lists') || '[]');
let currentUsername = localStorage.getItem('cine_username') || 'Invitado/a';
let sortDirection = "desc";
let catalogMediaType = "movie";
let isLoadingMore = false;
let currentUserBio = localStorage.getItem('cine_user_bio') || 'Apasionado del cine de autor y el análisis fílmico.';
let currentAvatarCustomUrl = localStorage.getItem('cine_avatar_custom_url') || null;
let currentAvatarSeed = localStorage.getItem('cine_avatar_seed') || 'Invitado/a';
let defaultMainTab = localStorage.getItem('cine_default_tab') || 'mural';

let currentDetailMenuMovie = null;
let currentDetailMovie = null;
let currentWinnerMovie = null;
let selectedStarRating = 0;
let pendingListDeleteId = null;

let isSpinning = false;
let startAngle = 0;
let lastSegmentIndex = -1;
let soundEnabled = true;
let autocompleteDebounceTimer = null;
let replyingTargetMap = {};

window.currentUsername = currentUsername;
window.currentAvatarSeed = currentAvatarSeed;
window.currentUserBio = currentUserBio;
window.currentAvatarCustomUrl = currentAvatarCustomUrl;

const EMOJI_LIST = ["🎬", "🍿", "🔥", "❤️", "👏", "🧠", "😲", "☕", "👎", "⭐", "🎭", "🎥", "🏆", "💀", "🍷", "✨"];

const OSCAR_DATABASE = [
    { oscarYear: 2024, isWinner: true, tmdbId: 872585, defaultTitle: "Oppenheimer" },
    { oscarYear: 2024, isWinner: false, tmdbId: 346698, defaultTitle: "Barbie" },
    { oscarYear: 2024, isWinner: false, tmdbId: 466420, defaultTitle: "Killers of the Flower Moon" },
    { oscarYear: 2024, isWinner: false, tmdbId: 792307, defaultTitle: "Poor Things" },
    { oscarYear: 2023, isWinner: true, tmdbId: 545611, defaultTitle: "Everything Everywhere All at Once" },
    { oscarYear: 2022, isWinner: true, tmdbId: 601498, defaultTitle: "CODA" },
    { oscarYear: 2021, isWinner: true, tmdbId: 581734, defaultTitle: "Nomadland" },
    { oscarYear: 2020, isWinner: true, tmdbId: 496243, defaultTitle: "Parasite" },
    { oscarYear: 2019, isWinner: true, tmdbId: 490132, defaultTitle: "Green Book" }
];

const EMMY_TV_DATABASE = [
    { oscarYear: 2024, isWinner: true, tmdbId: 136315, defaultTitle: "The Bear" },
    { oscarYear: 2023, isWinner: true, tmdbId: 76331, defaultTitle: "Succession" },
    { oscarYear: 2022, isWinner: false, tmdbId: 95396, defaultTitle: "Severance" },
    { oscarYear: 2019, isWinner: true, tmdbId: 87108, defaultTitle: "Chernobyl" },
    { oscarYear: 2015, isWinner: false, tmdbId: 60059, defaultTitle: "Better Call Saul" },
    { oscarYear: 2014, isWinner: true, tmdbId: 1396, defaultTitle: "Breaking Bad" },
    { oscarYear: 2008, isWinner: true, tmdbId: 1104, defaultTitle: "Mad Men" },
    { oscarYear: 2007, isWinner: true, tmdbId: 1398, defaultTitle: "The Sopranos" },
    { oscarYear: 2002, isWinner: false, tmdbId: 1438, defaultTitle: "The Wire" },
    { oscarYear: 1990, isWinner: false, tmdbId: 1920, defaultTitle: "Twin Peaks" }
];

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function makeModalDraggable(modalId, headerId) {
    const modal = document.getElementById(modalId);
    const header = document.getElementById(headerId);
    if (!modal || !header) return;

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = modal.firstElementChild.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        modal.firstElementChild.style.position = 'absolute';
        modal.firstElementChild.style.margin = '0';
        modal.firstElementChild.style.left = initialLeft + 'px';
        modal.firstElementChild.style.top = initialTop + 'px';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        modal.firstElementChild.style.left = (initialLeft + dx) + 'px';
        modal.firstElementChild.style.top = (initialTop + dy) + 'px';
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

function resetModalPosition(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const contentEl = modal.querySelector('.draggable-modal-content') || modal.firstElementChild;
    if (contentEl) {
        contentEl.style.position = '';
        contentEl.style.margin = '';
        contentEl.style.left = '';
        contentEl.style.top = '';
    }
}

function playTickSound() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
    } catch (e) { /* AudioContext opcional si el navegador bloquea reproducción automática */ }
}

function toggleSortDirection() {
    sortDirection = sortDirection === "desc" ? "asc" : "desc";
    const icon = document.getElementById('sortDirectionIcon');
    if (icon) {
        icon.className = sortDirection === "desc"
            ? "fa-solid fa-arrow-down-wide-short"
            : "fa-solid fa-arrow-up-short-wide";
    }
    resetAndFetchFilteredMovies();
}

function playVictorySound() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
            gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.08);
            osc.stop(ctx.currentTime + idx * 0.08 + 0.5);
        });
    } catch (e) { /* AudioContext opcional si el navegador bloquea reproducción automática */ }
}

function toggleTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('cine_theme', 'light');
        if (themeIcon) themeIcon.className = "fa-solid fa-sun text-xs text-amber-600";
    } else {
        html.classList.add('dark');
        localStorage.setItem('cine_theme', 'dark');
        if (themeIcon) themeIcon.className = "fa-solid fa-moon text-xs text-amber-400";
    }
    drawWheel();
}

if (localStorage.getItem('cine_theme') === 'light') {
    document.documentElement.classList.remove('dark');
    const tIcon = document.getElementById('themeIcon');
    if (tIcon) tIcon.className = "fa-solid fa-sun text-xs text-amber-600";
}

function toggleMute() {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('muteIcon');
    const text = document.getElementById('muteText');
    if (soundEnabled) {
        if (icon) icon.className = "fa-solid fa-volume-high text-rose-800 dark:text-rose-500";
        if (text) text.innerText = "Sonido activado";
    } else {
        if (icon) icon.className = "fa-solid fa-volume-xmark text-stone-400";
        if (text) text.innerText = "Silenciado";
    }
}

function toggleSettingsModal() {
    resetModalPosition('settingsModal');
    const modal = document.getElementById('settingsModal');
    const uInput = document.getElementById('usernameInput');
    const startPageSelect = document.getElementById('startPageSelect');
    const titleLangSelect = document.getElementById('titleLangSelect');
    const languageSelect = document.getElementById('languageSelect');
    const hideWatchedCheck = document.getElementById('hideWatchedPublicCheck');
    if (uInput) uInput.value = currentUsername;
    if (startPageSelect) startPageSelect.value = defaultMainTab;
    if (titleLangSelect) titleLangSelect.value = currentTitleLang;
    if (languageSelect) languageSelect.value = currentLang;
    if (hideWatchedCheck) hideWatchedCheck.checked = (localStorage.getItem('cine_hide_watched_public') === 'true');
    if (modal) modal.classList.toggle('hidden');
}

function toggleHideWatchedPublic(checked) {
    localStorage.setItem('cine_hide_watched_public', checked ? 'true' : 'false');
    if (typeof window.fbSyncPublicLibraryNow === 'function') {
        window.fbSyncPublicLibraryNow();
    }
    showToast(checked ? 'Tus películas vistas ahora están ocultas en tu perfil público.' : 'Tus películas vistas vuelven a ser visibles en tu perfil público.', 'info');
}

function updateUsername(val) {
    if (val.trim()) {
        currentUsername = val.trim();
        window.currentUsername = currentUsername;
        localStorage.setItem('cine_username', currentUsername);
        if (window.fbSaveProfile) window.fbSaveProfile({ username: currentUsername });
        updateProfileDrawerStats();
    }
}

function setStartPage(tabName) {
    defaultMainTab = tabName;
    localStorage.setItem('cine_default_tab', tabName);
}

async function ensureInitialRouletteSeed() {
    if (_rouletteSeeded) return;
    _rouletteSeeded = true;
    if (moviesList.length > 0) return;
    const initialIds = [872585, 98];
    const seeded = await Promise.all(initialIds.map(id => fetchDualLanguageMovie(`/movie/${id}`)));
    seeded.forEach(m => { if (m && !moviesList.some(x => x.id === m.id)) moviesList.push(m); });
    refreshRoulette();
}

function changeLanguage(newLang) {
    currentLang = newLang;
    localStorage.setItem('cine_lang', newLang);
    if (_catalogInitialized) resetAndFetchFilteredMovies();
    if (_oscarsInitialized) loadOscarMovies();
    if (typeof renderMuralFeed === 'function') renderMuralFeed();
    if (typeof refreshPostModal === 'function') refreshPostModal();
}

function changeTitleLanguage(newTitleLang) {
    currentTitleLang = newTitleLang;
    localStorage.setItem('cine_title_lang', newTitleLang);
    if (_catalogInitialized) resetAndFetchFilteredMovies();
    if (_oscarsInitialized) loadOscarMovies();
    if (typeof renderMuralFeed === 'function') renderMuralFeed();
    if (typeof refreshPostModal === 'function') refreshPostModal();
}

function switchMainTab(tabName) {
    const viewMural = document.getElementById('mainViewMural');
    const viewCatalog = document.getElementById('mainViewCatalog');
    const viewRoulette = document.getElementById('mainViewRoulette');

    const btnMural = document.getElementById('navMuralBtn');
    const btnCatalog = document.getElementById('navCatalogBtn');
    const btnRoulette = document.getElementById('navRouletteBtn');

    if (viewMural) viewMural.classList.add('hidden');
    if (viewCatalog) viewCatalog.classList.add('hidden');
    if (viewRoulette) viewRoulette.classList.add('hidden');

    const inactiveClasses = "px-4 py-2 journal-border bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 uppercase tracking-wider transition hover:bg-stone-300";
    const activeClasses = "px-4 py-2 journal-border bg-rose-900 text-stone-100 font-bold uppercase tracking-wider transition";

    if (btnMural) btnMural.className = inactiveClasses;
    if (btnCatalog) btnCatalog.className = inactiveClasses;
    if (btnRoulette) btnRoulette.className = inactiveClasses;

    if (tabName === 'mural') {
        if (viewMural) {
            viewMural.classList.remove('hidden');
            renderMuralFeed();
        }
        if (btnMural) btnMural.className = activeClasses;
    } else if (tabName === 'catalog') {
        if (viewCatalog) viewCatalog.classList.remove('hidden');
        if (btnCatalog) btnCatalog.className = activeClasses;
        if (!_catalogInitialized) {
            _catalogInitialized = true;
            resetAndFetchFilteredMovies();
        }
    } else if (tabName === 'roulette') {
        if (viewRoulette) viewRoulette.classList.remove('hidden');
        if (btnRoulette) btnRoulette.className = activeClasses;
        ensureInitialRouletteSeed();
        drawWheel();
    }
}

function toggleWatchedStatus(movieId) {
    if (!movieId) return;
    const parsed = _parseMediaId(movieId);
    const targetId = parsed.baseId;

    const index = watchedMovies.indexOf(targetId);
    if (index > -1) {
        watchedMovies.splice(index, 1);
        delete watchedMoviesData[targetId];
    } else {
        watchedMovies.push(targetId);
        const found = _findMovieById(targetId) || _findMovieById(movieId) || currentDetailMovie;
        if (found) {
            watchedMoviesData[targetId] = slimMovie({ ...found, id: targetId });
        }
    }

    localStorage.setItem('cine_watched_movies', JSON.stringify(watchedMovies));
    localStorage.setItem('cine_watched_movies_data', JSON.stringify(watchedMoviesData));

    updateWatchedBtnUI(targetId);
    updateProfileDrawerStats();
    renderResultsGrid();
}

function ensureWatchedMovie(movieId, movieObj) {
    if (!movieId) return;
    const parsed = _parseMediaId(movieId);
    const mid = parsed.baseId;
    if (!mid) return;
    if (!watchedMovies.includes(mid)) {
        watchedMovies.push(mid);
    }
    const found = movieObj || _findMovieById(mid);
    if (found && !watchedMoviesData[mid]) {
        watchedMoviesData[mid] = slimMovie({ ...found, id: mid, scopeLabel: undefined });
    }
    localStorage.setItem('cine_watched_movies', JSON.stringify(watchedMovies));
    localStorage.setItem('cine_watched_movies_data', JSON.stringify(watchedMoviesData));
    updateWatchedBtnUI(mid);
    updateProfileDrawerStats();
    renderResultsGrid();
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

function updateWatchedBtnUI(movieId) {
    const btn = document.getElementById('detailWatchedBtn');
    if (!btn) return;
    const isWatched = watchedMovies.includes(movieId);

    if (isWatched) {
        btn.className = "absolute top-2 right-2 bg-emerald-800 text-stone-100 p-2 journal-border text-xs transition shadow-md cursor-pointer";
        btn.innerHTML = `<i class="fa-solid fa-eye"></i>`;
        btn.title = "Marcar como no vista";
    } else {
        btn.className = "absolute top-2 right-2 bg-stone-900/80 hover:bg-rose-900 text-stone-100 p-2 journal-border text-xs transition shadow-md cursor-pointer";
        btn.innerHTML = `<i class="fa-regular fa-eye-slash"></i>`;
        btn.title = "Marcar como vista";
    }
}

let _detailTvState = {
    isTv: false,
    tmdbId: 0,
    baseId: '',
    baseSeriesObj: null,
    seriesTag: '',
    seasons: [],
    totalEpisodes: 0,
    selectedSeason: 1,
    selectedEpisode: null,
    selectedEpisodeName: '',
    selectedEpisodePoster: '',
    currentSeasonEpisodes: [],
    viewMode: 'series', // 'series' | 'season' | 'episode'
    activeTab: 'seasons', // 'seasons' | 'review'
    activeScope: 'series', // 'series' | 'season' | 'episode'
    activeReviewId: null,
    activeReviewMovieObj: null
};

function _loadReviewFieldsForTarget(targetId) {
    const pReview = personalReviews[targetId];
    renderStarSelector(pReview ? pReview.rating : 0);

    const userReviewInput = document.getElementById('userPersonalReview');
    if (userReviewInput) {
        userReviewInput.value = pReview ? pReview.review || '' : '';
        setTimeout(() => autoResizeTextarea(userReviewInput), 50);
    }

    const userReviewTitleInput = document.getElementById('userReviewTitleInput');
    if (userReviewTitleInput) userReviewTitleInput.value = pReview ? pReview.reviewTitle || '' : '';

    const publicCheck = document.getElementById('userPublicReviewCheck');
    if (publicCheck) publicCheck.checked = pReview ? pReview.isPublic !== false : true;

    const delReviewBtn = document.getElementById('deletePersonalReviewBtn');
    if (delReviewBtn) {
        const hasSavedReview = !!(pReview && ((pReview.review && String(pReview.review).trim()) || (pReview.reviewTitle && String(pReview.reviewTitle).trim()) || Number(pReview.rating) > 0));
        delReviewBtn.classList.toggle('hidden', !hasSavedReview);
    }
}

function _setDetailPosterLayout(isWidescreen) {
    const headerCard = document.getElementById('detailHeaderCard');
    const posterWrap = document.getElementById('detailPosterWrap');
    const posterImg = document.getElementById('detailPoster');
    if (!headerCard || !posterWrap || !posterImg) return;

    if (isWidescreen) {
        headerCard.className = "flex flex-col space-y-2.5 bg-stone-100 dark:bg-stone-950 p-2.5 journal-border";
        posterWrap.className = "relative w-full";
        posterImg.className = "w-full aspect-video object-cover journal-border shadow-md bg-stone-900";
    } else {
        headerCard.className = "flex items-start space-x-3 bg-stone-100 dark:bg-stone-950 p-2.5 journal-border";
        posterWrap.className = "relative flex-shrink-0";
        posterImg.className = "w-28 h-40 object-cover journal-border shadow-md";
    }
}

function _updateEpisodeWatchedBtnUI(seasonNum, epNum) {
    const btn = document.getElementById('detailWatchedBtn');
    if (!btn || !_detailTvState.isTv) return;
    const baseId = _detailTvState.baseId;
    const code = `S${Number(seasonNum)}E${Number(epNum)}`;
    const isWatched = Array.isArray(watchedEpisodes[baseId]) && watchedEpisodes[baseId].includes(code);
    if (isWatched) {
        btn.className = "absolute top-2 right-2 bg-emerald-800 text-stone-100 px-2 py-1.5 journal-border text-xs font-mono transition shadow-md cursor-pointer flex items-center gap-1";
        btn.innerHTML = `<i class="fa-solid fa-eye"></i><span class="text-[10px]">Visto</span>`;
        btn.title = "Capítulo visto (clic para desmarcar)";
    } else {
        btn.className = "absolute top-2 right-2 bg-stone-900/85 hover:bg-rose-900 text-stone-100 px-2 py-1.5 journal-border text-xs font-mono transition shadow-md cursor-pointer flex items-center gap-1";
        btn.innerHTML = `<i class="fa-regular fa-eye-slash"></i><span class="text-[10px]">Marcar visto</span>`;
        btn.title = "Marcar este capítulo como visto";
    }
}

function switchDetailSeriesTab(tab) {
    if (!_detailTvState.isTv) return;
    _detailTvState.activeTab = tab === 'review' ? 'review' : 'seasons';

    const btnSeasons = document.getElementById('detailTabBtnSeasons');
    const btnReview = document.getElementById('detailTabBtnReview');
    const seasonsPanel = document.getElementById('detailTvSeasonsSection');
    const reviewPanel = document.getElementById('detailReviewPanel');

    const activeCls = "py-2 px-3 bg-rose-900 text-stone-100 font-bold uppercase tracking-wider journal-border transition cursor-pointer flex items-center justify-center gap-1.5";
    const inactiveCls = "py-2 px-3 bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-800 uppercase tracking-wider journal-border transition cursor-pointer flex items-center justify-center gap-1.5";

    if (btnSeasons) btnSeasons.className = _detailTvState.activeTab === 'seasons' ? activeCls : inactiveCls;
    if (btnReview) btnReview.className = _detailTvState.activeTab === 'review' ? activeCls : inactiveCls;

    if (_detailTvState.activeTab === 'seasons') {
        if (seasonsPanel) {
            seasonsPanel.classList.remove('hidden');
            seasonsPanel.classList.add('flex');
        }
        if (reviewPanel) reviewPanel.classList.add('hidden');
    } else {
        if (seasonsPanel) {
            seasonsPanel.classList.add('hidden');
            seasonsPanel.classList.remove('flex');
        }
        if (reviewPanel) reviewPanel.classList.remove('hidden');
        selectTvReviewScope('series');
    }
}

function selectTvReviewScope(scope, seasonNum, epNum, epName, epPoster) {
    if (!_detailTvState.isTv || !currentDetailMovie) return;
    if (seasonNum != null) _detailTvState.selectedSeason = Number(seasonNum);
    if (epNum != null) {
        _detailTvState.selectedEpisode = Number(epNum);
        _detailTvState.selectedEpisodeName = epName || `Capítulo ${epNum}`;
        _detailTvState.selectedEpisodePoster = epPoster || '';
    }
    _detailTvState.activeScope = scope;

    const base = _detailTvState.baseSeriesObj || currentDetailMovie;
    const sNum = _detailTvState.selectedSeason || 1;
    const eNum = _detailTvState.selectedEpisode || 1;

    let targetId = _detailTvState.baseId;
    let scopeLabel = '';
    let scopeBadgeText = `📺 ${base.title} (Serie completa)`;
    let boxHeading = 'Bitácora y calificación de la serie';
    let posterToUse = base.poster;

    if (scope === 'season') {
        targetId = `${_detailTvState.baseId}_s${sNum}`;
        scopeLabel = `Temporada ${sNum}`;
        scopeBadgeText = `📂 ${base.title} · Temporada ${sNum}`;
        boxHeading = `Bitácora y calificación · Temporada ${sNum}`;
        const sObj = (_detailTvState.seasons || []).find(s => Number(s.season_number) === Number(sNum));
        if (sObj && sObj.poster_path) posterToUse = `https://image.tmdb.org/t/p/w500${sObj.poster_path}`;
    } else if (scope === 'episode') {
        targetId = `${_detailTvState.baseId}_s${sNum}_e${eNum}`;
        const epTitleShort = _detailTvState.selectedEpisodeName ? `: ${_detailTvState.selectedEpisodeName}` : '';
        scopeLabel = `T${sNum}·E${eNum}${epTitleShort}`.slice(0, 90);
        scopeBadgeText = `🎬 ${scopeLabel}`;
        boxHeading = `Bitácora y calificación · Capítulo ${eNum}`;
        if (_detailTvState.selectedEpisodePoster) posterToUse = _detailTvState.selectedEpisodePoster;
    }

    _detailTvState.activeReviewId = targetId;
    _detailTvState.activeReviewMovieObj = {
        ...base,
        id: targetId,
        poster: posterToUse || base.poster,
        mediaType: 'tv',
        scopeLabel: scopeLabel || undefined
    };

    const lbl = document.getElementById('detailReviewScopeLabel');
    if (lbl) lbl.textContent = scopeBadgeText;
    const headingEl = document.getElementById('detailReviewBoxHeading');
    if (headingEl) headingEl.textContent = boxHeading;

    _loadReviewFieldsForTarget(targetId);
    renderDetailPublicReviews(_detailTvState.activeReviewMovieObj);
}

function openEpisodeDetailView(seasonNum, epNum) {
    if (!_detailTvState.isTv) return;
    const sNum = Number(seasonNum || _detailTvState.selectedSeason || 1);
    const eNum = Number(epNum || 1);
    const base = _detailTvState.baseSeriesObj || currentDetailMovie;
    const eps = _detailTvState.currentSeasonEpisodes || [];
    const ep = eps.find(x => Number(x.episode_number) === eNum) || {
        episode_number: eNum,
        name: _detailTvState.selectedEpisodeName || `Capítulo ${eNum}`,
        overview: 'Sin descripción disponible para este capítulo.',
        vote_average: 0,
        runtime: null,
        air_date: '',
        still_path: ''
    };

    _detailTvState.viewMode = 'episode';
    _detailTvState.selectedSeason = sNum;
    _detailTvState.selectedEpisode = eNum;
    _detailTvState.selectedEpisodeName = ep.name || `Capítulo ${eNum}`;
    const stillHigh = ep.still_path ? `https://image.tmdb.org/t/p/w780${ep.still_path}` : (base.poster || POSTER_FALLBACK);
    const stillForPost = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : (base.poster || '');
    _detailTvState.selectedEpisodePoster = stillForPost;

    // 1. Mostrar barra superior de navegación de capítulo («← Volver a la serie» + Anterior / Siguiente)
    const headerModalTitle = document.getElementById('detailHeaderModalTitle');
    if (headerModalTitle) headerModalTitle.textContent = `Ficha de capítulo · ${base.title}`;

    const navBar = document.getElementById('detailSubViewNavBar');
    if (navBar) navBar.classList.remove('hidden');
    const backLbl = document.getElementById('detailBackToSeriesLabel');
    if (backLbl) backLbl.textContent = `Volver a ${base.title} (Temp. ${sNum})`;
    const epNavControls = document.getElementById('detailEpisodeNavControls');
    if (epNavControls) epNavControls.classList.remove('hidden');

    const curIdx = eps.findIndex(x => Number(x.episode_number) === eNum);
    const prevBtn = document.getElementById('detailPrevEpBtn');
    const nextBtn = document.getElementById('detailNextEpBtn');
    const epCounter = document.getElementById('detailEpCounterLabel');
    if (prevBtn) prevBtn.disabled = curIdx <= 0;
    if (nextBtn) nextBtn.disabled = curIdx === -1 || curIdx >= eps.length - 1;
    if (epCounter) epCounter.textContent = eps.length ? `Cap. ${eNum} de ${eps.length}` : `Cap. ${eNum}`;

    // 2. Transformar columna izquierda en la Ficha exclusiva del Capítulo (con imagen panorámica 16:9)
    _setDetailPosterLayout(true);
    const detailPoster = document.getElementById('detailPoster');
    if (detailPoster) detailPoster.src = stillHigh;

    const watchedBtn = document.getElementById('detailWatchedBtn');
    if (watchedBtn) {
        watchedBtn.onclick = () => {
            toggleEpisodeWatched(sNum, eNum);
            _updateEpisodeWatchedBtnUI(sNum, eNum);
        };
        _updateEpisodeWatchedBtnUI(sNum, eNum);
    }

    const detailTag = document.getElementById('detailTag');
    if (detailTag) detailTag.textContent = `${base.title} · Temporada ${sNum} · Cap. ${eNum}`;

    const detailTitle = document.getElementById('detailTitle');
    if (detailTitle) detailTitle.textContent = `E${eNum} · ${ep.name || 'Capítulo ' + eNum}`;

    const detailSubtitle = document.getElementById('detailSubtitle');
    if (detailSubtitle) detailSubtitle.classList.add('hidden');

    const detailRating = document.getElementById('detailRating');
    if (detailRating) {
        const rVal = ep.vote_average ? Number(ep.vote_average).toFixed(1) : (base.rating || 'N/A');
        detailRating.innerHTML = `<i class="fa-solid fa-star mr-1"></i>${rVal}`;
    }

    const detailVotes = document.getElementById('detailVotes');
    if (detailVotes) {
        detailVotes.innerHTML = ep.runtime
            ? `<i class="fa-regular fa-clock mr-1"></i>${ep.runtime} min`
            : `<i class="fa-solid fa-tv mr-1"></i>Temp. ${sNum}`;
    }

    const detailYear = document.getElementById('detailYear');
    if (detailYear) {
        detailYear.textContent = ep.air_date ? `Emisión: ${ep.air_date}` : `Año: ${base.year || 'N/A'}`;
    }

    const tvMeta = document.getElementById('detailTvMeta');
    if (tvMeta) tvMeta.classList.add('hidden');
    const progBox = document.getElementById('detailTvProgressBox');
    if (progBox) progBox.classList.add('hidden');

    const overviewLabel = document.getElementById('detailOverviewLabel');
    if (overviewLabel) overviewLabel.textContent = `Sinopsis del capítulo ${eNum}`;
    const detailOverview = document.getElementById('detailOverview');
    if (detailOverview) {
        detailOverview.innerText = ep.overview || 'Sin descripción disponible para este capítulo.';
    }

    const pubReviewsTitle = document.getElementById('detailPublicReviewsTitle');
    if (pubReviewsTitle) pubReviewsTitle.textContent = `Comentarios sobre este capítulo`;

    // 3. Mostrar directamente la Bitácora a la derecha (como en las películas)
    const tabsBar = document.getElementById('detailSeriesTabsBar');
    if (tabsBar) tabsBar.classList.add('hidden');
    const seasonsPanel = document.getElementById('detailTvSeasonsSection');
    if (seasonsPanel) {
        seasonsPanel.classList.add('hidden');
        seasonsPanel.classList.remove('flex');
    }
    const reviewPanel = document.getElementById('detailReviewPanel');
    if (reviewPanel) reviewPanel.classList.remove('hidden');

    selectTvReviewScope('episode', sNum, eNum, ep.name || `Capítulo ${eNum}`, stillForPost);
    if (_detailTvState.baseId) {
        const p = _parseMediaId(_detailTvState.baseId);
        renderDetailWatchProviders(p.tmdbId, true);
    }
}

function openSeasonDetailView(seasonNum) {
    if (!_detailTvState.isTv) return;
    const sNum = Number(seasonNum || _detailTvState.selectedSeason || 1);
    const base = _detailTvState.baseSeriesObj || currentDetailMovie;
    const sObj = (_detailTvState.seasons || []).find(s => Number(s.season_number) === sNum);

    _detailTvState.viewMode = 'season';
    _detailTvState.selectedSeason = sNum;

    const headerModalTitle = document.getElementById('detailHeaderModalTitle');
    if (headerModalTitle) headerModalTitle.textContent = `Ficha de temporada · ${base.title}`;

    const navBar = document.getElementById('detailSubViewNavBar');
    if (navBar) navBar.classList.remove('hidden');
    const backLbl = document.getElementById('detailBackToSeriesLabel');
    if (backLbl) backLbl.textContent = `Volver a ${base.title}`;
    const epNavControls = document.getElementById('detailEpisodeNavControls');
    if (epNavControls) epNavControls.classList.add('hidden');

    _setDetailPosterLayout(false);
    const sPoster = (sObj && sObj.poster_path) ? `https://image.tmdb.org/t/p/w500${sObj.poster_path}` : safePoster(base.poster);
    const detailPoster = document.getElementById('detailPoster');
    if (detailPoster) detailPoster.src = sPoster;

    const watchedBtn = document.getElementById('detailWatchedBtn');
    if (watchedBtn) {
        watchedBtn.onclick = () => toggleCurrentSeasonWatched();
        updateWatchedBtnUI(base.id);
    }

    const detailTag = document.getElementById('detailTag');
    if (detailTag) detailTag.textContent = `${base.title} · Temporada ${sNum}`;

    const detailTitle = document.getElementById('detailTitle');
    if (detailTitle) detailTitle.textContent = (sObj && sObj.name) ? `${sObj.name}` : `Temporada ${sNum}`;

    const detailSubtitle = document.getElementById('detailSubtitle');
    if (detailSubtitle) {
        detailSubtitle.textContent = base.title;
        detailSubtitle.classList.remove('hidden');
    }

    const detailRating = document.getElementById('detailRating');
    if (detailRating) detailRating.innerHTML = `<i class="fa-solid fa-star mr-1"></i>${base.rating || 'N/A'}`;

    const detailVotes = document.getElementById('detailVotes');
    if (detailVotes) {
        const epCnt = (sObj && sObj.episode_count) || _detailTvState.currentSeasonEpisodes.length || '?';
        detailVotes.innerHTML = `<i class="fa-solid fa-film mr-1"></i>${epCnt} capítulos`;
    }

    const detailYear = document.getElementById('detailYear');
    if (detailYear) {
        const sYear = (sObj && sObj.air_date) ? sObj.air_date.split('-')[0] : (base.year || 'N/A');
        detailYear.textContent = `Año: ${sYear}`;
    }

    const overviewLabel = document.getElementById('detailOverviewLabel');
    if (overviewLabel) overviewLabel.textContent = `Sinopsis de la Temporada ${sNum}`;
    const detailOverview = document.getElementById('detailOverview');
    if (detailOverview) {
        detailOverview.innerText = (sObj && sObj.overview) || base.overview || 'Sin descripción disponible.';
    }

    const pubReviewsTitle = document.getElementById('detailPublicReviewsTitle');
    if (pubReviewsTitle) pubReviewsTitle.textContent = `Comentarios sobre la Temporada ${sNum}`;

    const tabsBar = document.getElementById('detailSeriesTabsBar');
    if (tabsBar) tabsBar.classList.add('hidden');
    const seasonsPanel = document.getElementById('detailTvSeasonsSection');
    if (seasonsPanel) {
        seasonsPanel.classList.add('hidden');
        seasonsPanel.classList.remove('flex');
    }
    const reviewPanel = document.getElementById('detailReviewPanel');
    if (reviewPanel) reviewPanel.classList.remove('hidden');

    selectTvReviewScope('season', sNum);
}

function navigateDetailEpisode(delta) {
    if (!_detailTvState.isTv || _detailTvState.viewMode !== 'episode') return;
    const eps = _detailTvState.currentSeasonEpisodes || [];
    const curIdx = eps.findIndex(x => Number(x.episode_number) === Number(_detailTvState.selectedEpisode));
    if (curIdx === -1) return;
    const nextEp = eps[curIdx + delta];
    if (!nextEp) return;
    openEpisodeDetailView(_detailTvState.selectedSeason, nextEp.episode_number);
}

function returnToSeriesOverview(targetTab) {
    if (!_detailTvState.isTv) return;
    const base = _detailTvState.baseSeriesObj || currentDetailMovie;
    _detailTvState.viewMode = 'series';

    const headerModalTitle = document.getElementById('detailHeaderModalTitle');
    if (headerModalTitle) headerModalTitle.textContent = 'Ventana de detalle';

    const navBar = document.getElementById('detailSubViewNavBar');
    if (navBar) navBar.classList.add('hidden');

    _setDetailPosterLayout(false);
    const detailPoster = document.getElementById('detailPoster');
    if (detailPoster) detailPoster.src = safePoster(base.poster);

    const watchedBtn = document.getElementById('detailWatchedBtn');
    if (watchedBtn) {
        watchedBtn.onclick = () => toggleWatchedStatus(_detailTvState.baseId);
        updateWatchedBtnUI(_detailTvState.baseId);
    }

    const detailTag = document.getElementById('detailTag');
    if (detailTag) detailTag.textContent = _detailTvState.seriesTag || 'Ficha de serie TV';

    const detailTitle = document.getElementById('detailTitle');
    if (detailTitle) detailTitle.textContent = base.title || '';

    const detailSubtitle = document.getElementById('detailSubtitle');
    if (detailSubtitle) {
        if (base.subtitle && base.subtitle.trim() !== '' && base.subtitle !== base.title) {
            detailSubtitle.textContent = base.subtitle;
            detailSubtitle.classList.remove('hidden');
        } else {
            detailSubtitle.classList.add('hidden');
        }
    }

    const detailRating = document.getElementById('detailRating');
    if (detailRating) detailRating.innerHTML = `<i class="fa-solid fa-star mr-1"></i>${base.rating || 'N/A'}`;

    const detailVotes = document.getElementById('detailVotes');
    if (detailVotes) detailVotes.innerHTML = `<i class="fa-solid fa-users mr-1"></i>${base.votes || 0} votos`;

    const detailYear = document.getElementById('detailYear');
    if (detailYear) detailYear.textContent = `Año: ${base.year || 'N/A'}`;

    const tvMeta = document.getElementById('detailTvMeta');
    if (tvMeta) tvMeta.classList.remove('hidden');
    const progBox = document.getElementById('detailTvProgressBox');
    if (progBox) progBox.classList.remove('hidden');

    const overviewLabel = document.getElementById('detailOverviewLabel');
    if (overviewLabel) overviewLabel.textContent = 'Sinopsis editorial';
    const detailOverview = document.getElementById('detailOverview');
    if (detailOverview) detailOverview.innerText = base.overview || 'Sin descripción disponible.';

    const pubReviewsTitle = document.getElementById('detailPublicReviewsTitle');
    if (pubReviewsTitle) pubReviewsTitle.textContent = 'Comentarios del diario mural';

    const tabsBar = document.getElementById('detailSeriesTabsBar');
    if (tabsBar) tabsBar.classList.remove('hidden');

    _updateTvProgressUI();
    _renderDetailEpisodesList();
    selectTvReviewScope('series');
    switchDetailSeriesTab(targetTab || 'seasons');
    if (_detailTvState.baseId) {
        const p = _parseMediaId(_detailTvState.baseId);
        renderDetailWatchProviders(p.tmdbId, true);
    }
}

function _updateTvProgressUI() {
    if (!_detailTvState.isTv) return;
    const baseId = _detailTvState.baseId;
    const watchedArr = Array.isArray(watchedEpisodes[baseId]) ? watchedEpisodes[baseId] : [];
    const total = Math.max(_detailTvState.totalEpisodes || 0, watchedArr.length);
    const pct = total > 0 ? Math.min(100, Math.round((watchedArr.length / total) * 100)) : 0;

    const txt = document.getElementById('detailTvProgressText');
    if (txt) txt.textContent = `${watchedArr.length} / ${total || '?'} cap. vistos (${pct}%)`;
    const bar = document.getElementById('detailTvProgressBar');
    if (bar) bar.style.width = `${pct}%`;

    const sNum = _detailTvState.selectedSeason;
    const reviewSeasonBtn = document.getElementById('detailReviewSeasonBtn');
    if (reviewSeasonBtn) {
        const sId = `${baseId}_s${sNum}`;
        const hasSeasonReview = !!(personalReviews[sId] && (personalReviews[sId].review || personalReviews[sId].rating));
        reviewSeasonBtn.innerHTML = `<i class="fa-solid fa-feather-pointed mr-1"></i>${hasSeasonReview ? `Tu reseña T${sNum}` : `Reseñar T${sNum}`}`;
    }

    const markSeasonBtn = document.getElementById('detailMarkSeasonBtn');
    if (markSeasonBtn && _detailTvState.currentSeasonEpisodes.length) {
        const allSeasonWatched = _detailTvState.currentSeasonEpisodes.every(ep =>
            watchedArr.includes(`S${sNum}E${ep.episode_number}`)
        );
        markSeasonBtn.innerHTML = allSeasonWatched
            ? `<i class="fa-solid fa-rotate-left mr-1"></i>Desmarcar T${sNum}`
            : `<i class="fa-solid fa-check-double mr-1"></i>T${sNum} vista`;
        markSeasonBtn.className = allSeasonWatched
            ? 'px-2.5 py-1.5 bg-emerald-800 text-stone-100 text-[10px] font-mono uppercase journal-border transition cursor-pointer'
            : 'px-2.5 py-1.5 bg-stone-200 dark:bg-stone-800 hover:bg-emerald-900 hover:text-stone-100 text-[10px] font-mono uppercase journal-border transition cursor-pointer';
    }
}

function toggleEpisodeWatched(seasonNum, epNum) {
    if (!_detailTvState.isTv) return;
    const baseId = _detailTvState.baseId;
    const code = `S${Number(seasonNum)}E${Number(epNum)}`;
    if (!Array.isArray(watchedEpisodes[baseId])) watchedEpisodes[baseId] = [];
    const arr = watchedEpisodes[baseId];
    const idx = arr.indexOf(code);
    if (idx > -1) arr.splice(idx, 1);
    else arr.push(code);

    localStorage.setItem('cine_watched_episodes', JSON.stringify(watchedEpisodes));
    if (_detailTvState.totalEpisodes > 0 && arr.length >= _detailTvState.totalEpisodes) {
        ensureWatchedMovie(baseId, _detailTvState.baseSeriesObj || currentDetailMovie);
    }
    _updateTvProgressUI();
    _renderDetailEpisodesList();
    if (_detailTvState.viewMode === 'episode' && Number(_detailTvState.selectedSeason) === Number(seasonNum) && Number(_detailTvState.selectedEpisode) === Number(epNum)) {
        _updateEpisodeWatchedBtnUI(seasonNum, epNum);
    }
    renderResultsGrid();
}

function toggleCurrentSeasonWatched() {
    if (!_detailTvState.isTv || !_detailTvState.currentSeasonEpisodes.length) return;
    const baseId = _detailTvState.baseId;
    const sNum = _detailTvState.selectedSeason;
    if (!Array.isArray(watchedEpisodes[baseId])) watchedEpisodes[baseId] = [];
    const arr = watchedEpisodes[baseId];
    const codes = _detailTvState.currentSeasonEpisodes.map(ep => `S${sNum}E${ep.episode_number}`);
    const allWatched = codes.every(c => arr.includes(c));

    if (allWatched) {
        watchedEpisodes[baseId] = arr.filter(c => !codes.includes(c));
    } else {
        codes.forEach(c => { if (!arr.includes(c)) arr.push(c); });
    }
    localStorage.setItem('cine_watched_episodes', JSON.stringify(watchedEpisodes));
    if (_detailTvState.totalEpisodes > 0 && watchedEpisodes[baseId].length >= _detailTvState.totalEpisodes) {
        ensureWatchedMovie(baseId, _detailTvState.baseSeriesObj || currentDetailMovie);
    }
    _updateTvProgressUI();
    _renderDetailEpisodesList();
    renderResultsGrid();
}

function _renderDetailEpisodesList() {
    const listEl = document.getElementById('detailEpisodesList');
    if (!listEl) return;
    const eps = _detailTvState.currentSeasonEpisodes || [];
    if (!eps.length) {
        listEl.innerHTML = `<p class="text-[11px] font-serif italic text-stone-400 text-center py-4">No hay información de episodios para esta temporada.</p>`;
        return;
    }
    const baseId = _detailTvState.baseId;
    const sNum = _detailTvState.selectedSeason;
    const watchedArr = Array.isArray(watchedEpisodes[baseId]) ? watchedEpisodes[baseId] : [];

    listEl.innerHTML = eps.map(ep => {
        const epNum = ep.episode_number;
        const code = `S${sNum}E${epNum}`;
        const isWatched = watchedArr.includes(code);
        const epId = `${baseId}_s${sNum}_e${epNum}`;
        const myRev = personalReviews[epId];
        const hasMyReview = !!(myRev && (myRev.review || myRev.rating));
        const myRatingBadge = (myRev && myRev.rating)
            ? `<span class="text-rose-700 dark:text-rose-400 font-bold"><i class="fa-solid fa-feather-pointed mr-0.5"></i>${Number(myRev.rating).toFixed(1)} (Tú)</span>`
            : '';
        const stillUrl = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : '';
        const ratingStr = ep.vote_average ? Number(ep.vote_average).toFixed(1) : '';
        const runtimeStr = ep.runtime ? `${ep.runtime} min` : '';
        const dateStr = ep.air_date ? ep.air_date.split('-')[0] : '';

        return `
            <div onclick="openEpisodeDetailView(${sNum}, ${epNum})" class="p-2.5 bg-stone-50 dark:bg-stone-900 hover:border-rose-800 dark:hover:border-rose-500 journal-border flex items-start gap-3 transition cursor-pointer group ${isWatched ? 'opacity-80 border-l-2 border-l-emerald-600' : ''}">
                <button type="button" onclick="event.stopPropagation(); toggleEpisodeWatched(${sNum}, ${epNum})" title="${isWatched ? 'Capítulo visto (clic para desmarcar)' : 'Marcar capítulo como visto'}" class="mt-0.5 w-7 h-7 flex-shrink-0 flex items-center justify-center journal-border text-xs transition cursor-pointer ${isWatched ? 'bg-emerald-800 text-stone-100' : 'bg-stone-200 dark:bg-stone-950 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'}">
                    <i class="fa-solid fa-check"></i>
                </button>
                ${stillUrl ? `<img src="${_pmEsc(stillUrl)}" loading="lazy" alt="" class="w-24 h-14 object-cover journal-border flex-shrink-0 bg-stone-800 group-hover:opacity-95 transition">` : `<div class="w-24 h-14 journal-border flex-shrink-0 bg-stone-200 dark:bg-stone-950 flex items-center justify-center text-stone-400 text-sm"><i class="fa-solid fa-tv"></i></div>`}
                <div class="flex-grow min-w-0">
                    <div class="flex items-start justify-between gap-2">
                        <span class="font-heading font-bold text-xs sm:text-[13px] text-stone-900 dark:text-stone-100 group-hover:text-rose-800 dark:group-hover:text-rose-400 transition leading-snug">E${epNum} · ${_pmEsc(ep.name || 'Capítulo ' + epNum)}</span>
                        <span class="flex-shrink-0 px-2 py-0.5 text-[9px] font-mono uppercase journal-border transition ${hasMyReview ? 'bg-rose-900 text-stone-100 font-bold' : 'bg-stone-200/80 dark:bg-stone-950 text-rose-800 dark:text-rose-400 group-hover:bg-rose-900 group-hover:text-stone-100'}">
                            <i class="fa-solid fa-feather-pointed mr-1"></i>${hasMyReview ? 'Ver tu reseña' : 'Ficha / Reseñar →'}
                        </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-[10px] font-mono text-stone-500 mt-0.5">
                        ${ratingStr && ratingStr !== '0.0' ? `<span class="text-amber-600 dark:text-amber-400 font-bold"><i class="fa-solid fa-star mr-0.5"></i>${ratingStr}</span>` : ''}
                        ${runtimeStr ? `<span>${runtimeStr}</span>` : ''}
                        ${dateStr ? `<span>· ${dateStr}</span>` : ''}
                        ${myRatingBadge}
                    </div>
                    ${ep.overview ? `<p class="text-[11px] font-serif text-stone-600 dark:text-stone-400 mt-1 leading-snug line-clamp-2">${_pmEsc(ep.overview)}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function onDetailSeasonChange(seasonNum, preselectEpisodeNum) {
    if (!_detailTvState.isTv) return;
    const sNum = Number(seasonNum) || 1;
    _detailTvState.selectedSeason = sNum;

    const sel = document.getElementById('detailSeasonSelect');
    if (sel && String(sel.value) !== String(sNum)) sel.value = String(sNum);

    const sObj = (_detailTvState.seasons || []).find(s => Number(s.season_number) === sNum);
    const sOverviewEl = document.getElementById('detailSeasonOverview');
    if (sOverviewEl) {
        if (sObj && sObj.overview) {
            sOverviewEl.textContent = sObj.overview;
            sOverviewEl.classList.remove('hidden');
        } else {
            sOverviewEl.classList.add('hidden');
        }
    }

    const listEl = document.getElementById('detailEpisodesList');
    if (listEl) listEl.innerHTML = `<p class="text-[11px] font-mono text-stone-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Cargando capítulos de Temporada ${sNum}...</p>`;

    const seasonData = await fetchTvSeasonDual(_detailTvState.tmdbId, sNum);
    if (!_detailTvState.isTv || _detailTvState.selectedSeason !== sNum) return;

    _detailTvState.currentSeasonEpisodes = (seasonData && Array.isArray(seasonData.episodes)) ? seasonData.episodes : [];
    _updateTvProgressUI();
    _renderDetailEpisodesList();

    if (preselectEpisodeNum != null) {
        openEpisodeDetailView(sNum, preselectEpisodeNum);
    } else if (_detailTvState.viewMode === 'season') {
        openSeasonDetailView(sNum);
    }
}

async function _initDetailTvExplorer(movie, parsed, tag) {
    const tvSection = document.getElementById('detailTvSeasonsSection');
    const tabsBar = document.getElementById('detailSeriesTabsBar');
    const reviewPanel = document.getElementById('detailReviewPanel');
    const navBar = document.getElementById('detailSubViewNavBar');
    const scopeBar = document.getElementById('detailReviewScopeBar');
    const tvMeta = document.getElementById('detailTvMeta');
    const progBox = document.getElementById('detailTvProgressBox');
    const headerModalTitle = document.getElementById('detailHeaderModalTitle');
    const overviewLabel = document.getElementById('detailOverviewLabel');
    const pubReviewsTitle = document.getElementById('detailPublicReviewsTitle');
    const reviewHeading = document.getElementById('detailReviewBoxHeading');

    _setDetailPosterLayout(false);
    if (navBar) navBar.classList.add('hidden');
    if (headerModalTitle) headerModalTitle.textContent = 'Ventana de detalle';
    if (overviewLabel) overviewLabel.textContent = 'Sinopsis editorial';
    if (pubReviewsTitle) pubReviewsTitle.textContent = 'Comentarios del diario mural';
    if (reviewHeading) reviewHeading.textContent = 'Bitácora y calificación personal';

    if (!parsed.isTv || !parsed.tmdbId) {
        _detailTvState.isTv = false;
        _detailTvState.viewMode = 'series';
        _detailTvState.activeReviewId = movie.id;
        _detailTvState.activeReviewMovieObj = movie;
        if (tvSection) { tvSection.classList.add('hidden'); tvSection.classList.remove('flex'); }
        if (tabsBar) tabsBar.classList.add('hidden');
        if (reviewPanel) reviewPanel.classList.remove('hidden');
        if (scopeBar) scopeBar.classList.add('hidden');
        if (tvMeta) tvMeta.classList.add('hidden');
        if (progBox) progBox.classList.add('hidden');
        return;
    }

    const baseSeries = { ...movie, id: parsed.baseId, mediaType: 'tv', scopeLabel: undefined };
    const initialViewMode = parsed.episodeNumber ? 'episode' : (parsed.seasonNumber ? 'season' : 'series');
    _detailTvState = {
        isTv: true,
        tmdbId: parsed.tmdbId,
        baseId: parsed.baseId,
        baseSeriesObj: baseSeries,
        seriesTag: tag || 'Ficha de serie TV',
        seasons: [],
        totalEpisodes: 0,
        selectedSeason: parsed.seasonNumber || 1,
        selectedEpisode: parsed.episodeNumber || null,
        selectedEpisodeName: '',
        selectedEpisodePoster: '',
        currentSeasonEpisodes: [],
        viewMode: initialViewMode,
        activeTab: 'seasons',
        activeScope: initialViewMode,
        activeReviewId: movie.id,
        activeReviewMovieObj: movie
    };

    if (scopeBar) scopeBar.classList.remove('hidden');
    if (progBox) progBox.classList.remove('hidden');
    if (tvMeta) {
        tvMeta.textContent = '📺 Serie de TV · Cargando temporadas...';
        tvMeta.classList.remove('hidden');
    }

    if (initialViewMode === 'series') {
        if (tabsBar) tabsBar.classList.remove('hidden');
        switchDetailSeriesTab('seasons');
    }

    const listEl = document.getElementById('detailEpisodesList');
    if (listEl) listEl.innerHTML = `<p class="text-[11px] font-mono text-stone-400 text-center py-6"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Cargando temporadas y capítulos...</p>`;

    const details = await fetchDualLanguageMovie(`/tv/${parsed.tmdbId}`);
    if (!currentDetailMovie || _parseMediaId(currentDetailMovie.id).baseId !== parsed.baseId) return;

    if (details) {
        _detailTvState.baseSeriesObj = { ...baseSeries, ...details, id: parsed.baseId, mediaType: 'tv' };
        _detailTvState.seasons = (details.seasons || []).filter(s => s && Number(s.season_number) > 0);
        if (!_detailTvState.seasons.length && Array.isArray(details.seasons)) {
            _detailTvState.seasons = details.seasons;
        }
        _detailTvState.totalEpisodes = Number(details.number_of_episodes || details.numberOfEpisodes) || _detailTvState.seasons.reduce((acc, s) => acc + (Number(s.episode_count) || 0), 0);

        if (tvMeta) {
            const nS = details.number_of_seasons || details.numberOfSeasons || _detailTvState.seasons.length || 1;
            const nE = _detailTvState.totalEpisodes || '?';
            tvMeta.textContent = `📺 Serie TV · ${nS} temp. · ${nE} episodios`;
        }
        const detailOverview = document.getElementById('detailOverview');
        if (_detailTvState.viewMode === 'series' && detailOverview && (!movie.overview || movie.overview === 'Sin descripción' || movie.overview === 'Sin descripción disponible.') && details.overview) {
            detailOverview.innerText = details.overview;
        }
    }

    const sel = document.getElementById('detailSeasonSelect');
    if (sel) {
        sel.innerHTML = (_detailTvState.seasons || []).map(s =>
            `<option value="${s.season_number}">Temporada ${s.season_number}${s.name && !/^temporada|^season/i.test(s.name) ? ' — ' + _pmEsc(s.name) : ''} (${s.episode_count || 0} cap.)</option>`
        ).join('');
    }

    const initialSeason = parsed.seasonNumber || (_detailTvState.seasons[0] ? _detailTvState.seasons[0].season_number : 1);
    selectTvReviewScope('series');
    await onDetailSeasonChange(initialSeason, parsed.episodeNumber);
    if (!parsed.episodeNumber && parsed.seasonNumber) {
        openSeasonDetailView(initialSeason);
    }
}

function openDetailModal(movie, tag) {
    resetModalPosition('detailModal');

    const modalContent = document.querySelector('#detailModal .draggable-modal-content');
    if (modalContent) {
        modalContent.style.width = '';
        modalContent.style.height = '';
        modalContent.style.maxWidth = '';
        modalContent.style.maxHeight = '';
    }

    const parsed = _parseMediaId(movie.id);
    if (parsed.isTv) movie.mediaType = 'tv';
    currentDetailMovie = movie;
    _detailTvState.activeReviewId = movie.id;
    _detailTvState.activeReviewMovieObj = movie;

    const detailTag = document.getElementById('detailTag');
    if (detailTag) detailTag.innerText = tag || (parsed.isTv ? "Ficha de serie TV" : "Reseña crítica");

    const detailTitle = document.getElementById('detailTitle');
    if (detailTitle) detailTitle.textContent = movie.title || '';

    const detailSubtitle = document.getElementById('detailSubtitle');
    if (detailSubtitle) {
        if (movie.subtitle && movie.subtitle.trim() !== '' && movie.subtitle !== movie.title) {
            detailSubtitle.textContent = movie.subtitle;
            detailSubtitle.classList.remove('hidden');
        } else {
            detailSubtitle.classList.add('hidden');
        }
    }

    const detailPoster = document.getElementById('detailPoster');
    if (detailPoster) detailPoster.src = safePoster(movie.poster);

    const detailRating = document.getElementById('detailRating');
    if (detailRating) {
        detailRating.innerHTML = `<i class="fa-solid fa-star mr-1"></i>${movie.rating || 'N/A'}`;
    }

    const detailVotes = document.getElementById('detailVotes');
    if (detailVotes) {
        detailVotes.innerHTML = `<i class="fa-solid fa-users mr-1"></i>${movie.votes || 0} votos`;
    }

    const detailYear = document.getElementById('detailYear');
    if (detailYear) {
        const movieYear = movie.year ? movie.year : 'N/A';
        detailYear.innerText = `Año: ${movieYear}`;
    }

    const detailOverview = document.getElementById('detailOverview');
    if (detailOverview) {
        detailOverview.style.height = '';
        detailOverview.innerText = movie.overview || 'Sin descripción disponible.';
    }

    const watchedBtn = document.getElementById('detailWatchedBtn');
    if (watchedBtn) {
        watchedBtn.onclick = () => toggleWatchedStatus(parsed.baseId);
        updateWatchedBtnUI(parsed.baseId);
    }

    const addBtn = document.getElementById('detailAddBtn');
    if (addBtn) {
        addBtn.onclick = () => {
            const added = addMoviesToRoulette([{ ...movie, id: parsed.baseId }]);
            const label = addBtn.querySelector('span');
            if (label) {
                label.innerText = added ? 'Añadida ✓' : 'Ya está en el sorteo';
                setTimeout(() => { label.innerText = 'Añadir a sorteo'; }, 1500);
            }
        };
    }
    renderDetailPublicReviews(movie);
    _loadReviewFieldsForTarget(movie.id);
    _initDetailTvExplorer(movie, parsed, tag);
    renderDetailWatchProviders(parsed.tmdbId, parsed.isTv);

    const detailModal = document.getElementById('detailModal');
    if (detailModal) {
        detailModal.classList.remove('hidden');
        detailModal.classList.remove('z-[100]');
        detailModal.classList.add('z-[250]');
    }
}

function closeDetailModal() {
    const detailModal = document.getElementById('detailModal');
    if (detailModal) detailModal.classList.add('hidden');
    const wpSec = document.getElementById('detailWatchProvidersSection');
    if (wpSec) wpSec.classList.add('hidden');
}

// ===== PLATAFORMAS DE STREAMING EN CHILE (JustWatch / TMDb) =====
const _watchProvidersCache = new Map();
let _currentWatchProviderRequestId = 0;

async function fetchWatchProvidersChile(tmdbId, isTv) {
    if (!tmdbId) return null;
    const cacheKey = `${isTv ? 'tv' : 'movie'}_${tmdbId}`;
    const cached = _watchProvidersCache.get(cacheKey);
    if (cached && (Date.now() - cached.t < 30 * 60 * 1000)) {
        return cached.data;
    }
    const endpoint = `/${isTv ? 'tv' : 'movie'}/${tmdbId}/watch/providers`;
    try {
        const json = await fetchFromTMDb(endpoint);
        const clData = json && json.results && json.results.CL ? json.results.CL : null;
        _watchProvidersCache.set(cacheKey, { t: Date.now(), data: clData });
        return clData;
    } catch (e) {
        return null;
    }
}

async function renderDetailWatchProviders(tmdbId, isTv) {
    const section = document.getElementById('detailWatchProvidersSection');
    const list = document.getElementById('detailWatchProvidersList');
    if (!section || !list) return;

    if (!tmdbId) {
        section.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    const reqId = ++_currentWatchProviderRequestId;
    section.classList.remove('hidden');
    list.innerHTML = `
        <div class="flex items-center gap-2 py-1 text-stone-400 dark:text-stone-500 italic text-xs font-mono">
            <i class="fa-solid fa-spinner fa-spin text-rose-800 dark:text-rose-400"></i>
            <span>Consultando catálogo de Chile...</span>
        </div>`;

    const data = await fetchWatchProvidersChile(tmdbId, isTv);
    if (reqId !== _currentWatchProviderRequestId) return; // Solicitud obsoleta

    const flatrate = (data && Array.isArray(data.flatrate)) ? data.flatrate : [];
    const free = (data && Array.isArray(data.free)) ? data.free : [];
    const ads = (data && Array.isArray(data.ads)) ? data.ads : [];
    const rent = (data && Array.isArray(data.rent)) ? data.rent : [];
    const buy = (data && Array.isArray(data.buy)) ? data.buy : [];

    const streamProviders = [...flatrate, ...free, ...ads];
    const seen = new Set();
    const uniqueStream = streamProviders.filter(p => {
        if (!p || !p.provider_id || seen.has(p.provider_id)) return false;
        seen.add(p.provider_id);
        return true;
    });

    if (uniqueStream.length === 0 && rent.length === 0 && buy.length === 0) {
        list.innerHTML = `
            <div class="p-2 bg-stone-100 dark:bg-stone-950 journal-border text-stone-500 text-[11px] leading-relaxed">
                <span>No figura en streaming por suscripción en Chile actualmente.</span>
                ${data && data.link ? `<a href="${data.link}" target="_blank" rel="noopener noreferrer" class="ml-1 text-rose-800 dark:text-rose-400 hover:underline inline-flex items-center gap-1 font-bold">Ver opciones en JustWatch <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i></a>` : ''}
            </div>`;
        return;
    }

    let html = '';

    if (uniqueStream.length > 0) {
        html += `
            <div class="space-y-1">
                <span class="text-[10px] uppercase font-bold text-stone-600 dark:text-stone-400 tracking-wider">Streaming (Suscripción):</span>
                <div class="flex flex-wrap gap-1.5 pt-0.5">
                    ${uniqueStream.map(p => `
                        <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-stone-100 dark:bg-stone-950 hover:bg-stone-200 dark:hover:bg-stone-800 journal-border transition" title="${_pmEsc(p.provider_name)}">
                            ${p.logo_path ? `<img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${_pmEsc(p.provider_name)}" class="w-4 h-4 rounded object-cover shadow-xs flex-shrink-0">` : '<i class="fa-solid fa-tv text-rose-800 text-[10px]"></i>'}
                            <span class="text-[11px] font-bold text-stone-800 dark:text-stone-200">${_pmEsc(p.provider_name)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    const rentBuy = [...rent, ...buy].filter(p => {
        if (!p || !p.provider_id || seen.has(p.provider_id)) return false;
        seen.add(p.provider_id);
        return true;
    });

    if (rentBuy.length > 0) {
        html += `
            <div class="pt-1 text-[10px] text-stone-500 dark:text-stone-400">
                <span class="font-bold text-stone-600 dark:text-stone-300">Alquiler / Compra:</span>
                <span class="ml-1">${rentBuy.map(p => _pmEsc(p.provider_name)).slice(0, 4).join(', ')}${rentBuy.length > 4 ? ` (+${rentBuy.length - 4})` : ''}</span>
            </div>`;
    }

    if (data && data.link) {
        html += `
            <div class="pt-0.5 text-right">
                <a href="${data.link}" target="_blank" rel="noopener noreferrer" class="text-[10px] text-rose-800 dark:text-rose-400 hover:underline inline-flex items-center gap-1 font-mono">
                    <span>Más opciones y precios en JustWatch</span>
                    <i class="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                </a>
            </div>`;
    }

    list.innerHTML = html;
}

// ===== EXPORTAR TARJETA EDITORIAL / FANZINE (CANVAS) =====
const _exportCardState = {
    movie: null,
    review: null,
    format: 'story', // 'story' (9:16) | 'feed' (4:5)
    theme: 'dark',   // 'dark' (Noir) | 'light' (Pergamino)
    blob: null,
    dataUrl: null
};

function _loadCorsImage(url) {
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        let done = false;
        const timer = setTimeout(() => {
            if (!done) { done = true; resolve(null); }
        }, 5000);
        img.onload = () => {
            if (!done) { done = true; clearTimeout(timer); resolve(img); }
        };
        img.onerror = () => {
            if (!done) { done = true; clearTimeout(timer); resolve(null); }
        };
        img.src = url;
    });
}

function _wrapCanvasText(ctx, text, maxWidth, maxLines = 4) {
    if (!text) return [];
    const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let cur = '';

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && cur) {
            lines.push(cur);
            cur = w;
            if (lines.length === maxLines - 1) {
                let last = cur;
                i++;
                while (i < words.length && ctx.measureText(last + ' ' + words[i] + '...').width <= maxWidth) {
                    last += ' ' + words[i];
                    i++;
                }
                if (i < words.length) last += '...';
                lines.push(last);
                return lines;
            }
        } else {
            cur = test;
        }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    return lines;
}

function _syncExportCardControls() {
    const isStory = _exportCardState.format === 'story';
    const isDark = _exportCardState.theme === 'dark';

    const bStory = document.getElementById('exportFmtStory');
    const bFeed = document.getElementById('exportFmtFeed');
    const bDark = document.getElementById('exportThemeDark');
    const bLight = document.getElementById('exportThemeLight');

    const activeCls = ['bg-rose-900', 'text-stone-100', 'font-bold'];
    const inactiveCls = ['bg-stone-200', 'dark:bg-stone-800', 'text-stone-700', 'dark:text-stone-300', 'font-normal'];

    if (bStory && bFeed) {
        if (isStory) {
            bStory.classList.add(...activeCls); bStory.classList.remove(...inactiveCls);
            bFeed.classList.remove(...activeCls); bFeed.classList.add(...inactiveCls);
        } else {
            bFeed.classList.add(...activeCls); bFeed.classList.remove(...inactiveCls);
            bStory.classList.remove(...activeCls); bStory.classList.add(...inactiveCls);
        }
    }

    if (bDark && bLight) {
        if (isDark) {
            bDark.classList.add(...activeCls); bDark.classList.remove(...inactiveCls);
            bLight.classList.remove(...activeCls); bLight.classList.add(...inactiveCls);
        } else {
            bLight.classList.add(...activeCls); bLight.classList.remove(...inactiveCls);
            bDark.classList.remove(...activeCls); bDark.classList.add(...inactiveCls);
        }
    }
}

function setExportCardFormat(fmt) {
    if (_exportCardState.format === fmt) return;
    _exportCardState.format = fmt;
    _syncExportCardControls();
    generateExportCardCanvas();
}

function setExportCardTheme(th) {
    if (_exportCardState.theme === th) return;
    _exportCardState.theme = th;
    _syncExportCardControls();
    generateExportCardCanvas();
}

function closeExportCardModal() {
    const modal = document.getElementById('exportCardModal');
    if (modal) modal.classList.add('hidden');
}

function openExportCardModalFromDetail() {
    if (!currentDetailMovie) {
        showToast('No hay ninguna obra seleccionada.', 'info');
        return;
    }

    const isEpisode = _detailTvState.isTv && _detailTvState.viewMode === 'episode';
    const targetId = isEpisode ? _detailTvState.activeReviewId : currentDetailMovie.id;
    const baseMovie = isEpisode ? (_detailTvState.activeReviewMovieObj || currentDetailMovie) : currentDetailMovie;
    const pReview = personalReviews[targetId] || null;

    _exportCardState.movie = {
        ...baseMovie,
        isEpisode,
        seasonNumber: isEpisode ? _detailTvState.selectedSeason : null,
        episodeNumber: isEpisode ? _detailTvState.selectedEpisode : null,
        episodeName: isEpisode ? _detailTvState.selectedEpisodeName : null,
        poster: isEpisode ? (_detailTvState.selectedEpisodePoster || baseMovie.poster) : baseMovie.poster
    };

    _exportCardState.review = pReview ? {
        reviewTitle: pReview.reviewTitle || '',
        review: pReview.review || '',
        rating: pReview.rating,
        author: currentUsername || 'CineZine',
        avatarSeed: currentUserAvatarSeed || currentUsername,
        date: new Date(pReview.updatedAt || pReview.createdAt || Date.now()).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    } : null;

    _exportCardState.format = _exportCardState.format || 'story';
    _exportCardState.theme = _exportCardState.theme || 'dark';
    _syncExportCardControls();

    const modal = document.getElementById('exportCardModal');
    if (modal) modal.classList.remove('hidden');

    generateExportCardCanvas();
}

function openExportCardModalFromPost(postId) {
    const post = (Array.isArray(allPosts) ? allPosts.find(p => p.id === postId) : null)
        || (window._extraPosts && window._extraPosts[postId])
        || null;

    if (!post) {
        showToast('No se encontró la publicación para exportar.', 'error');
        return;
    }

    const movie = (typeof _resolveViewerMovie === 'function' ? _resolveViewerMovie(post) : null)
        || post.movieObj
        || { title: post.movieTitle || 'Obra', poster: post.poster || POSTER_FALLBACK };

    _exportCardState.movie = movie;
    _exportCardState.review = {
        reviewTitle: post.reviewTitle || '',
        review: post.content || post.review || '',
        rating: post.rating != null ? post.rating : null,
        author: post.author || 'CineZine',
        authorUid: post.authorUid || '',
        avatarSeed: post.avatarSeed || post.author,
        date: post.date || new Date(post.createdAt || Date.now()).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    _exportCardState.format = _exportCardState.format || 'story';
    _exportCardState.theme = _exportCardState.theme || 'dark';
    _syncExportCardControls();

    const modal = document.getElementById('exportCardModal');
    if (modal) modal.classList.remove('hidden');

    generateExportCardCanvas();
}

async function generateExportCardCanvas() {
    const modal = document.getElementById('exportCardModal');
    const loadingEl = document.getElementById('exportCardLoading');
    const previewImg = document.getElementById('exportCardPreviewImg');
    if (!modal || modal.classList.contains('hidden')) return;

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (previewImg) previewImg.classList.add('hidden');

    const movie = _exportCardState.movie || currentDetailMovie || {};
    const review = _exportCardState.review || null;
    const isStory = _exportCardState.format === 'story';
    const isDark = _exportCardState.theme === 'dark';

    const W = 1080;
    const H = isStory ? 1920 : 1350;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Colores de la paleta editorial
    const bg = isDark ? '#141210' : '#f5f0e6';
    const textCol = isDark ? '#f5f0e6' : '#1c1917';
    const textMuted = isDark ? '#a8a29e' : '#78716c';
    const accentRed = isDark ? '#dc2626' : '#991b1b';
    const borderCol = isDark ? '#3d3731' : '#d4ccbe';
    const boxBg = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.035)';
    const starCol = isDark ? '#f59e0b' : '#d97706';

    // 1. Fondo base
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Grano sutil fanzine
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)';
    for (let i = 0; i < 4000; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
    }

    // 3. Bordes dobles de diario
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    ctx.strokeStyle = accentRed;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    // Esquinas decorativas
    ctx.fillStyle = accentRed;
    [[48, 48], [W - 48, 48], [48, H - 48], [W - 48, H - 48]].forEach(([cx, cy]) => {
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
    });

    // 4. Cabecera editorial (Masthead)
    ctx.fillStyle = accentRed;
    ctx.font = "bold 20px 'Space Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText("★  C I N E Z I N E  ·  D I A R I O   C I N É F I L O  ★", W / 2, 95);

    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 118);
    ctx.lineTo(W - 80, 118);
    ctx.stroke();

    // 5. Cargar imagen de poster / still y avatar en paralelo
    const posterUrl = movie.poster ? (movie.poster.startsWith('http') ? movie.poster : `https://image.tmdb.org/t/p/w780${movie.poster}`) : null;
    const authorAvatarSeed = (review && review.avatarSeed) || currentUserAvatarSeed || currentUsername || 'cine';
    const authorName = (review && review.author) || currentUsername || 'Dani & Mauri';
    const avatarUrl = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(authorAvatarSeed)}`;

    const [posterImg, avatarImg] = await Promise.all([
        _loadCorsImage(posterUrl),
        _loadCorsImage(avatarUrl)
    ]);

    // 6. Dibujar Poster / Fotograma
    const isWide = !!(movie.isEpisode || (posterImg && posterImg.width / posterImg.height > 1.2));
    let pw, ph, px, py;

    if (isStory) {
        if (isWide) {
            pw = 860; ph = 484; px = (W - pw) / 2; py = 150;
        } else {
            pw = 540; ph = 810; px = (W - pw) / 2; py = 150;
        }
    } else {
        if (isWide) {
            pw = 740; ph = 416; px = (W - pw) / 2; py = 145;
        } else {
            pw = 400; ph = 600; px = (W - pw) / 2; py = 145;
        }
    }

    if (posterImg) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(posterImg, px, py, pw, ph);
        ctx.restore();

        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 3;
        ctx.strokeRect(px, py, pw, ph);
    } else {
        ctx.fillStyle = boxBg;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, ph);
        ctx.fillStyle = textMuted;
        ctx.font = "italic 32px Georgia, serif";
        ctx.textAlign = 'center';
        ctx.fillText(movie.title || 'CineZine', W / 2, py + ph / 2);
    }

    // 7. Metadata y Título
    let curY = py + ph + (isStory ? 45 : 32);

    let tag = '';
    if (movie.isEpisode) {
        tag = `SERIE TV · T${movie.seasonNumber || 1}:E${movie.episodeNumber || 1}`;
    } else {
        const parsed = _parseMediaId(movie.id);
        const yStr = movie.year ? String(movie.year) : '';
        tag = (parsed.isTv ? 'SERIE TV' : 'PELÍCULA') + (yStr ? ` · ${yStr}` : '');
    }

    ctx.fillStyle = accentRed;
    ctx.font = "bold 20px 'Space Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(tag.toUpperCase(), W / 2, curY);
    curY += (isStory ? 48 : 38);

    const titleText = movie.isEpisode && movie.episodeName ? `${movie.title}: ${movie.episodeName}` : (movie.title || 'Sin título');
    ctx.fillStyle = textCol;
    ctx.font = `bold ${isStory ? 46 : 38}px 'Playfair Display', Georgia, serif`;
    ctx.textAlign = 'center';
    const titleLines = _wrapCanvasText(ctx, titleText, 900, 2);
    titleLines.forEach(l => {
        ctx.fillText(l, W / 2, curY);
        curY += (isStory ? 52 : 42);
    });

    // 8. Puntuación en estrellas
    const ratingVal = (review && review.rating != null) ? Number(review.rating) : (movie.rating ? Math.round(Number(movie.rating) / 2 * 10) / 10 : null);
    if (ratingVal != null && ratingVal > 0) {
        let starsStr = '';
        for (let s = 1; s <= 5; s++) {
            if (ratingVal >= s) starsStr += '★ ';
            else if (ratingVal >= s - 0.5) starsStr += '★ ';
            else starsStr += '☆ ';
        }
        ctx.fillStyle = starCol;
        ctx.font = "30px 'Playfair Display', Georgia, serif";
        ctx.textAlign = 'center';
        ctx.fillText(`${starsStr.trim()}   (${ratingVal}/5)`, W / 2, curY);
        curY += (isStory ? 42 : 32);
    }

    // 9. Caja de Apunte / Reseña / Cita Editorial
    const footerTop = H - 120;
    const boxX = 80;
    const boxW = W - 160;
    const boxY = curY + 10;
    const boxH = Math.max(120, footerTop - boxY - 20);

    if (boxH >= 110) {
        ctx.fillStyle = boxBg;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        const headline = (review && review.reviewTitle) ? review.reviewTitle.trim() : '';
        const quoteBody = (review && review.review) ? review.review.trim() : (movie.overview || 'Una obra seleccionada en el diario cinéfilo CineZine.');

        let qy = boxY + 40;
        if (headline) {
            ctx.fillStyle = accentRed;
            ctx.font = `bold ${isStory ? 26 : 22}px 'Playfair Display', Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`“${headline}”`, W / 2, qy);
            qy += 34;
        }

        ctx.fillStyle = textCol;
        ctx.font = `italic ${isStory ? 22 : 19}px Georgia, serif`;
        ctx.textAlign = 'center';
        const maxLines = Math.max(2, Math.floor((boxY + boxH - qy - 15) / (isStory ? 32 : 26)));
        const quoteLines = _wrapCanvasText(ctx, headline ? quoteBody : `“${quoteBody}”`, boxW - 60, maxLines);
        quoteLines.forEach(l => {
            ctx.fillText(l, W / 2, qy);
            qy += (isStory ? 32 : 26);
        });
    }

    // 10. Pie de página (Autor + Sello de autenticidad)
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, H - 110);
    ctx.lineTo(W - 80, H - 110);
    ctx.stroke();

    if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(115, H - 65, 24, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, 91, H - 89, 48, 48);
        ctx.restore();
        ctx.strokeStyle = accentRed;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(115, H - 65, 25, 0, Math.PI * 2);
        ctx.stroke();
    }

    const textLeftX = avatarImg ? 150 : 90;
    ctx.textAlign = 'left';
    ctx.fillStyle = textCol;
    ctx.font = "bold 15px 'Space Mono', monospace";
    ctx.fillText(`CRÍTICA POR ${authorName.toUpperCase()}`, textLeftX, H - 72);

    const dateStr = (review && review.date) || new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    ctx.fillStyle = textMuted;
    ctx.font = "13px 'Space Mono', monospace";
    ctx.fillText(dateStr.toUpperCase(), textLeftX, H - 54);

    ctx.textAlign = 'right';
    ctx.fillStyle = accentRed;
    ctx.font = "bold 15px 'Space Mono', monospace";
    ctx.fillText("CINEZINE · ARCHIVO", W - 90, H - 72);

    ctx.fillStyle = textMuted;
    ctx.font = "13px 'Space Mono', monospace";
    ctx.fillText("cinezine.vercel.app", W - 90, H - 54);

    // 11. Generar Blob y DataURL
    try {
        const dataUrl = canvas.toDataURL('image/png');
        _exportCardState.dataUrl = dataUrl;
        canvas.toBlob((blob) => {
            _exportCardState.blob = blob;
        }, 'image/png');

        if (previewImg) {
            previewImg.src = dataUrl;
            previewImg.classList.remove('hidden');
        }
    } catch (taintErr) {
        _exportCardState.blob = null;
        _exportCardState.dataUrl = null;
        showToast('No se pudo generar la vista previa debido a restricciones de seguridad de imagen.', 'error');
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function downloadExportCard() {
    if (!_exportCardState.dataUrl) {
        showToast('Generando tarjeta, espera un momento...', 'info');
        return;
    }
    const movie = _exportCardState.movie || {};
    const title = (movie.title || 'obra').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const cleanFileName = `cinezine-${title}-${_exportCardState.format}-${_exportCardState.theme}.png`;

    const a = document.createElement('a');
    a.href = _exportCardState.dataUrl;
    a.download = cleanFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Tarjeta fanzine descargada ✓', 'ok');
}

async function shareExportCard() {
    if (!_exportCardState.blob) {
        if (_exportCardState.dataUrl) {
            downloadExportCard();
            showToast('Imagen descargada. ¡Lista para compartir en WhatsApp o Instagram Stories! 📱', 'ok');
            return;
        }
        showToast('Generando tarjeta, espera un momento...', 'info');
        return;
    }

    const movie = _exportCardState.movie || {};
    const title = movie.title || 'CineZine';
    const cleanTitle = (title).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `cinezine-${cleanTitle}.png`;

    try {
        const file = new File([_exportCardState.blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `${title} · CineZine`,
                text: `Mi crítica de ${title} en CineZine`,
                files: [file]
            });
            showToast('¡Tarjeta compartida! ✓', 'ok');
            return;
        }
    } catch (err) {
        if (err && err.name === 'AbortError') return;
    }

    // Fallback: descargar directamente
    downloadExportCard();
    showToast('Imagen descargada. ¡Lista para compartir en WhatsApp o Instagram Stories! 📱', 'ok');
}

function showWinnerModal(movie) {
    resetModalPosition('winnerModal');
    currentWinnerMovie = movie;

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.innerText = movie.title;

    const modalPoster = document.getElementById('modalPoster');
    if (modalPoster) modalPoster.src = safePoster(movie.poster);

    const modalRating = document.getElementById('modalRating');
    if (modalRating) {
        modalRating.innerHTML = `<i class="fa-solid fa-star mr-1"></i>${movie.rating || 'N/A'}`;
    }

    const modalVotes = document.getElementById('modalVotes');
    if (modalVotes) {
        modalVotes.innerHTML = `<i class="fa-solid fa-users mr-1"></i>${movie.votes || 0} votos`;
    }

    const modalOverview = document.getElementById('modalOverview');
    if (modalOverview) {
        modalOverview.innerText = movie.overview || 'Sin descripción disponible.';
    }

    const wBtn = document.getElementById('winnerWatchedBtn');
    if (wBtn) {
        wBtn.onclick = () => { currentDetailMovie = movie; toggleWatchedStatus(movie.id); updateWinnerWatchedUI(movie.id); };
        updateWinnerWatchedUI(movie.id);
    }
    const wListBtn = document.getElementById('winnerAddListBtn');
    if (wListBtn) wListBtn.onclick = (e) => { currentDetailMovie = movie; openQuickListMenuFromDetail(e); };

    const modal = document.getElementById('winnerModal');
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('winnerModal');
    if (modal) modal.classList.add('hidden');
}

// Selector de estrellas del modal de detalle con soporte de medias estrellas (0.5) y teclado
function renderStarSelector(val) {
    selectedStarRating = Number(val) || 0;
    const container = document.getElementById('starContainer');
    if (!container) return;
    container.innerHTML = '';
    container.setAttribute('role', 'slider');
    container.setAttribute('aria-valuemin', '0');
    container.setAttribute('aria-valuemax', '10');
    container.setAttribute('aria-valuenow', String(selectedStarRating));
    container.setAttribute('aria-label', 'Calificación personal de 0 a 10 en pasos de 0.5');
    const textEl = document.getElementById('starRatingText');
    if (textEl) textEl.innerText = selectedStarRating.toFixed(1);

    for (let i = 1; i <= 10; i++) {
        const starWrapper = document.createElement('button');
        starWrapper.type = 'button';
        starWrapper.className = "relative w-6 h-6 flex items-center justify-center cursor-pointer text-sm px-0.5 text-stone-300 dark:text-stone-700 hover:scale-110 transition-transform focus:outline-none focus:ring-1 focus:ring-amber-500";
        starWrapper.setAttribute('aria-label', `${i} de 10 estrellas (flechas ajustan media estrella)`);
        let iconClass = "fa-regular fa-star text-stone-300 dark:text-stone-700";
        if (selectedStarRating >= i) {
            iconClass = "fa-solid fa-star text-amber-600";
        } else if (selectedStarRating >= i - 0.5) {
            iconClass = "fa-solid fa-star-half-stroke text-amber-600";
        }
        starWrapper.innerHTML = `<i class="${iconClass}"></i>`;
        starWrapper.onclick = (e) => {
            if (!e || e.detail === 0) {
                selectedStarRating = i;
            } else {
                const rect = starWrapper.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                selectedStarRating = (clickX < rect.width / 2) ? i - 0.5 : i;
            }
            renderStarSelector(selectedStarRating);
        };
        starWrapper.onkeydown = (e) => {
            let next = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                next = Math.min(10, Math.round((selectedStarRating + 0.5) * 2) / 2);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                next = Math.max(0, Math.round((selectedStarRating - 0.5) * 2) / 2);
            } else if (e.key === 'Home' || e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                next = 0;
            } else if (e.key === 'End') {
                e.preventDefault();
                next = 10;
            }
            if (next !== null) {
                renderStarSelector(next);
                const buttons = container.querySelectorAll('button');
                const focusIdx = Math.max(0, Math.min(9, Math.ceil(next || 1) - 1));
                if (buttons[focusIdx]) buttons[focusIdx].focus();
            }
        };
        container.appendChild(starWrapper);
    }
}

function clearPersonalRating() { selectedStarRating = 0; renderStarSelector(0); }

async function _removePersonalReviewEverywhere(movieId) {
    const key = String(movieId);
    const numId = Number(movieId);
    delete personalReviews[key];
    if (numId) delete personalReviews[numId];
    localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));

    if (window.currentUser) {
        try {
            if (window.fbRemoveReviewPost) await window.fbRemoveReviewPost(numId || key);
            const myPosts = (window.muralPosts || []).filter(p =>
                p.type === 'review' &&
                (p.authorUid === window.currentUser.uid || p.userId === window.currentUser.uid) &&
                String(p.tmdbMovieId || (p.movieObj && p.movieObj.id)) === key
            );
            for (const p of myPosts) {
                if (window.fbDeletePost) await window.fbDeletePost(p.id);
            }
        } catch (e) { console.warn('No se pudo borrar del muro:', e); }
    }

    const activeTargetId = (_detailTvState.isTv && _detailTvState.activeReviewId) ? String(_detailTvState.activeReviewId) : (currentDetailMovie ? String(currentDetailMovie.id) : '');
    if (activeTargetId === key) {
        renderStarSelector(0);
        const rInput = document.getElementById('userPersonalReview');
        if (rInput) { rInput.value = ''; autoResizeTextarea(rInput); }
        const tInput = document.getElementById('userReviewTitleInput');
        if (tInput) tInput.value = '';
        const delBtn = document.getElementById('deletePersonalReviewBtn');
        if (delBtn) delBtn.classList.add('hidden');
    }
    if (_detailTvState.isTv) _renderDetailEpisodesList();

    updateProfileDrawerStats();
    renderResultsGrid();
    renderMuralFeed();
}

function confirmDeletePersonalReview(movieId) {
    showDeleteConfirmationModal(async () => {
        await _removePersonalReviewEverywhere(movieId);
        showToast('Apunte eliminado ✓', 'ok');
    }, 'Eliminar apunte', '¿Seguro que deseas borrar este apunte y su calificación? Si estaba publicado en el muro, también se quitará de allí.');
}

function deletePersonalReviewFromDetail() {
    if (!currentDetailMovie) return;
    const targetId = (_detailTvState.isTv && _detailTvState.activeReviewId) ? _detailTvState.activeReviewId : currentDetailMovie.id;
    confirmDeletePersonalReview(targetId);
}

async function savePersonalReview() {
    if (!currentDetailMovie) return;
    const targetId = (_detailTvState.isTv && _detailTvState.activeReviewId) ? _detailTvState.activeReviewId : currentDetailMovie.id;
    const targetMovieObj = (_detailTvState.isTv && _detailTvState.activeReviewMovieObj) ? _detailTvState.activeReviewMovieObj : currentDetailMovie;

    const reviewInput = document.getElementById('userPersonalReview').value.trim();
    const reviewTitleInput = document.getElementById('userReviewTitleInput') ? document.getElementById('userReviewTitleInput').value.trim() : '';
    const isPublic = document.getElementById('userPublicReviewCheck').checked;
    const ratingNow = selectedStarRating > 0 ? selectedStarRating : null;

    if (!reviewInput && !reviewTitleInput && !ratingNow) {
        await _removePersonalReviewEverywhere(targetId);
        showToast('Apunte vacío eliminado ✓', 'info');
        return;
    }

    const nowMs = Date.now();
    const prev = personalReviews[targetId];
    const slimTarget = slimMovie(targetMovieObj);
    personalReviews[targetId] = {
        movie: slimTarget,
        rating: ratingNow,
        review: reviewInput,
        reviewTitle: reviewTitleInput,
        isPublic: isPublic,
        createdAt: (prev && prev.createdAt) || nowMs,
        updatedAt: nowMs
    };
    localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));
    if (ratingNow > 0) {
        const parsed = _parseMediaId(targetId);
        if (parsed.isTv && parsed.seasonNumber != null && parsed.episodeNumber != null) {
            const code = `S${parsed.seasonNumber}E${parsed.episodeNumber}`;
            if (!Array.isArray(watchedEpisodes[parsed.baseId])) watchedEpisodes[parsed.baseId] = [];
            if (!watchedEpisodes[parsed.baseId].includes(code)) {
                watchedEpisodes[parsed.baseId].push(code);
                localStorage.setItem('cine_watched_episodes', JSON.stringify(watchedEpisodes));
            }
            _updateTvProgressUI();
            _renderDetailEpisodesList();
        } else {
            ensureWatchedMovie(parsed.baseId, _detailTvState.baseSeriesObj || currentDetailMovie);
        }
    }
    const delReviewBtn = document.getElementById('deletePersonalReviewBtn');
    if (delReviewBtn) delReviewBtn.classList.remove('hidden');
    if (_detailTvState.isTv) _renderDetailEpisodesList();
    updateProfileDrawerStats();

    if (window.currentUser && window.fbUpsertReviewPost) {
        try {
            if (isPublic && reviewInput) {
                await window.fbUpsertReviewPost(targetId, {
                    author: _myName(), avatarSeed: currentAvatarSeed,
                    reviewTitle: reviewTitleInput.slice(0, 150), content: reviewInput.slice(0, 5000),
                    rating: ratingNow, movieObj: slimTarget
                });
            } else {
                await window.fbRemoveReviewPost(targetId);
            }
        } catch (err) { handleWriteError(err, 'publicar tu reseña en el muro'); }
    } else if (isPublic && reviewInput) {
        showToast('Inicia sesión para que tu reseña pública aparezca en el muro.', 'info');
    }

    const indicator = document.getElementById('saveStatusIndicator');
    if (indicator) {
        indicator.classList.remove('hidden');
        setTimeout(() => indicator.classList.add('hidden'), 2500);
    }
}

// ===== CUADERNOS PERSONALIZADOS (con opción Pública/Privada y Drag & Drop) =====
function createNewList() {
    const input = document.getElementById('newListInput');
    const name = input.value.trim();
    if (!name) return;
    customLists.push({ id: Date.now(), name: name, isPublic: true, movies: [] });
    saveAndRenderCustomLists();
    updateProfileDrawerStats();
    input.value = '';
}

function saveAndRenderCustomLists() {
    localStorage.setItem('cine_custom_lists', JSON.stringify(customLists));
    renderCustomLists();
}

function toggleListPrivacy(listIndex) {
    if (!customLists[listIndex]) return;
    customLists[listIndex].isPublic = customLists[listIndex].isPublic === false ? true : false;
    saveAndRenderCustomLists();
    showToast(customLists[listIndex].isPublic ? 'Cuaderno marcado como público' : 'Cuaderno marcado como privado', 'info');
}

function renderCustomLists() {
    const container = document.getElementById('customListsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (customLists.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-stone-400 text-xs font-serif italic">Sin cuadernos creados.</div>`;
        return;
    }

    customLists.forEach((list, listIndex) => {
        const isPublic = list.isPublic !== false;
        const item = document.createElement('div');
        item.className = "bg-stone-100 dark:bg-stone-950 journal-border overflow-hidden transition-all";

        let headerHtml = `
            <div class="p-3 flex items-center justify-between bg-stone-100 dark:bg-stone-950 hover:bg-stone-200/50 dark:hover:bg-stone-900 transition select-none">
                <div onclick="toggleListAccordion(${listIndex})" class="flex items-center space-x-2 flex-grow cursor-pointer min-w-0">
                    <i class="fa-solid fa-book text-rose-800 text-xs"></i>
                    <h4 class="text-xs font-heading font-bold text-rose-900 dark:text-rose-400 truncate">${_pmEsc(list.name)}</h4>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <button onclick="toggleListPrivacy(${listIndex})" title="${isPublic ? 'Cuaderno público (clic para hacer privado)' : 'Cuaderno privado (clic para hacer público)'}" class="text-stone-400 hover:text-rose-600 px-1 py-0.5 text-xs transition cursor-pointer">
                        <i class="fa-solid ${isPublic ? 'fa-globe' : 'fa-lock text-amber-600'}"></i>
                    </button>
                    <span class="text-[10px] font-mono bg-stone-200 dark:bg-stone-900 px-2 py-0.5 journal-border">${list.movies ? list.movies.length : 0} obras</span>
                    <button onclick="confirmDeleteCustomList(${listIndex})" title="Eliminar cuaderno" class="text-stone-400 hover:text-rose-600 px-1 py-0.5 text-xs transition cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
                    <button onclick="toggleListAccordion(${listIndex})" class="text-stone-400 hover:text-stone-800 dark:hover:text-white text-xs px-1 cursor-pointer">
                        <i id="listChevron_${listIndex}" class="fa-solid fa-chevron-down transition-transform"></i>
                    </button>
                </div>
            </div>
        `;

        let moviesContentHtml = `<div id="listBody_${listIndex}" class="hidden border-t border-stone-200 dark:border-stone-800 p-2.5 space-y-2 bg-stone-50 dark:bg-stone-900/50">`;

        if (!list.movies || list.movies.length === 0) {
            moviesContentHtml += `<p class="text-[11px] font-serif italic text-stone-400 text-center py-3">Este cuaderno está vacío. Añade obras desde su detalle.</p>`;
        } else {
            moviesContentHtml += `<div class="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">`;
            list.movies.forEach((m, mIndex) => {
                const mTitle = m.title || m;
                const movieId = m.id || 872585;
                const poster = m.poster || POSTER_FALLBACK;

                moviesContentHtml += `
                    <div draggable="true" 
                         ondragstart="onDragStartMovie(event, ${listIndex}, ${mIndex})" 
                         ondragover="onDragOverMovie(event)" 
                         ondrop="onDropMovie(event, ${listIndex}, ${mIndex})" 
                         class="flex items-center justify-between bg-stone-100 dark:bg-stone-950 p-2 journal-border text-xs group cursor-grab active:cursor-grabbing hover:border-rose-800 transition">
                        <div class="flex items-center space-x-2 overflow-hidden flex-grow cursor-pointer" onclick="openRegisteredMovie(${_regMovie({ id: movieId, title: String(mTitle), subtitle: m.subtitle || '', poster, rating: m.rating || '8.5', overview: m.overview || 'Sin descripción', year: m.year, mediaType: m.mediaType, scopeLabel: m.scopeLabel }, 'Cuaderno: ' + list.name)})">
                            <i class="fa-solid fa-grip-vertical text-stone-400 text-[10px] group-hover:text-stone-700 dark:group-hover:text-stone-200"></i>
                            <span class="font-mono text-[10px] text-stone-400 w-4 text-right">${mIndex + 1}.</span>
                            <span class="font-serif font-bold text-stone-800 dark:text-stone-200 truncate hover:text-rose-800 dark:hover:text-rose-400 transition">${_pmEsc(mTitle)}</span>
                        </div>
                        <button onclick="confirmRemoveMovieFromList(${listIndex}, '${_pmEsc(movieId)}')" title="Quitar de la lista" class="text-stone-400 hover:text-rose-600 px-1.5 py-0.5 text-xs transition cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            });
            moviesContentHtml += `</div>`;
        }
        moviesContentHtml += `</div>`;

        item.innerHTML = headerHtml + moviesContentHtml;
        container.appendChild(item);
    });
}

function toggleListAccordion(listIndex) {
    const body = document.getElementById(`listBody_${listIndex}`);
    const chevron = document.getElementById(`listChevron_${listIndex}`);
    if (!body) return;

    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    } else {
        body.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
    }
}

let draggedMovieInfo = null;

function onDragStartMovie(e, listIndex, movieIndex) {
    draggedMovieInfo = { listIndex, movieIndex };
    e.dataTransfer.effectAllowed = 'move';
}

function onDragOverMovie(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onDropMovie(e, targetListIndex, targetMovieIndex) {
    e.preventDefault();
    if (!draggedMovieInfo) return;
    if (draggedMovieInfo.listIndex !== targetListIndex) return;

    const listIndex = targetListIndex;
    const sourceIndex = draggedMovieInfo.movieIndex;
    const destIndex = targetMovieIndex;

    if (sourceIndex === destIndex) return;

    const movies = customLists[listIndex].movies;
    const [movedMovie] = movies.splice(sourceIndex, 1);
    movies.splice(destIndex, 0, movedMovie);

    draggedMovieInfo = null;
    saveAndRenderCustomLists();
    setTimeout(() => mantenerAcordeonAbierto(listIndex), 50);
}

function mantenerAcordeonAbierto(listIndex) {
    const body = document.getElementById(`listBody_${listIndex}`);
    const chevron = document.getElementById(`listChevron_${listIndex}`);
    if (body) body.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180');
}

function removeMovieFromList(listIndex, movieId) {
    customLists[listIndex].movies = customLists[listIndex].movies.filter(m => String(m.id) !== String(movieId));
    saveAndRenderCustomLists();
    setTimeout(() => mantenerAcordeonAbierto(listIndex), 50);
}

function toggleEmojiPicker(inputId) {
    let existing = document.getElementById('emojiPickerDropdown');
    if (existing) {
        existing.remove();
        return;
    }

    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'emojiPickerDropdown';
    dropdown.className = 'absolute z-50 bg-stone-100 dark:bg-stone-950 journal-border p-2 grid grid-cols-4 gap-1.5 shadow-xl text-lg w-44';

    dropdown.style.bottom = '100%';
    dropdown.style.marginBottom = '4px';
    dropdown.style.left = '0px';

    EMOJI_LIST.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p-1 hover:bg-stone-200 dark:hover:bg-stone-800 transition rounded text-center cursor-pointer';
        btn.innerText = emoji;
        btn.onclick = () => {
            insertEmojiAtCursor(inputEl, emoji);
            dropdown.remove();
        };
        dropdown.appendChild(btn);
    });

    const wrapper = inputEl.parentElement;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dropdown);

    setTimeout(() => {
        window.addEventListener('click', function closeEmoji(e) {
            if (!dropdown.contains(e.target) && e.target.id !== `emojiBtn_${inputId}`) {
                dropdown.remove();
                window.removeEventListener('click', closeEmoji);
            }
        });
    }, 100);
}

function insertEmojiAtCursor(input, emoji) {
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    const text = input.value;
    input.value = text.substring(0, start) + emoji + text.substring(end);
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.focus();
}

function showDeleteConfirmationModal(onConfirm, customTitle = "Eliminar apunte", customText = "¿Estás seguro de que deseas eliminar este comentario? Esta acción no se puede deshacer.") {
    let confirmModal = document.getElementById('customConfirmModal');
    if (!confirmModal) {
        confirmModal = document.createElement('div');
        confirmModal.id = 'customConfirmModal';
        confirmModal.className = 'fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-[300] hidden flex items-center justify-center p-4';
        document.body.appendChild(confirmModal);
    }

    confirmModal.innerHTML = `
        <div class="bg-stone-50 dark:bg-stone-900 journal-border max-w-sm w-full p-5 space-y-4 text-center relative shadow-2xl animate-fade-in">
            <div class="w-10 h-10 mx-auto rounded-full bg-rose-900/10 text-rose-800 dark:text-rose-400 journal-border flex items-center justify-center text-lg">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="space-y-1">
                <h4 class="font-heading font-bold text-sm text-stone-900 dark:text-stone-100 uppercase tracking-wider">${_pmEsc(customTitle)}</h4>
                <p class="font-serif text-xs text-stone-600 dark:text-stone-400">${_pmEsc(customText)}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 font-mono text-xs">
                <button id="cancelConfirmBtn" class="py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 journal-border transition uppercase tracking-wider cursor-pointer">
                    Cancelar
                </button>
                <button id="acceptConfirmBtn" class="py-2 bg-rose-900 hover:bg-rose-800 text-stone-100 journal-border transition uppercase tracking-wider font-bold cursor-pointer">
                    Eliminar
                </button>
            </div>
        </div>
    `;

    confirmModal.classList.remove('hidden');

    document.getElementById('cancelConfirmBtn').onclick = () => {
        confirmModal.classList.add('hidden');
    };

    document.getElementById('acceptConfirmBtn').onclick = () => {
        confirmModal.classList.add('hidden');
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    };
}

function confirmDeleteCustomList(listIndex) {
    const listName = customLists[listIndex].name;
    showDeleteConfirmationModal(() => {
        customLists.splice(listIndex, 1);
        saveAndRenderCustomLists();
        updateProfileDrawerStats();
    }, "Eliminar cuaderno", `¿Estás seguro de que deseas eliminar el cuaderno "${listName}"? Se perderán todas las obras guardadas en él.`);
}

function confirmRemoveMovieFromList(listIndex, movieId) {
    showDeleteConfirmationModal(() => {
        customLists[listIndex].movies = customLists[listIndex].movies.filter(m => String(m.id) !== String(movieId));
        saveAndRenderCustomLists();
        setTimeout(() => mantenerAcordeonAbierto(listIndex), 50);
    }, "Quitar obra", "¿Estás seguro de que deseas quitar esta obra del cuaderno?");
}

function getAvatarUrl() {
    if (currentAvatarCustomUrl && /^https:\/\//i.test(currentAvatarCustomUrl)) return currentAvatarCustomUrl;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentAvatarSeed)}`;
}

function saveUserBioFromDrawer(val) {
    currentUserBio = val.trim();
    window.currentUserBio = currentUserBio;
    localStorage.setItem('cine_user_bio', currentUserBio);
    if (window.fbSaveProfile) window.fbSaveProfile({ bio: currentUserBio });
}

function toggleProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const backdrop = document.getElementById('profileDrawerBackdrop');
    if (!drawer || !backdrop) return;

    if (drawer.classList.contains('translate-x-full')) {
        updateProfileDrawerStats();
        backdrop.classList.remove('hidden');
        drawer.classList.remove('translate-x-full');
    } else {
        drawer.classList.add('translate-x-full');
        backdrop.classList.add('hidden');
    }
}

function setAvatarByWordPrompt() {
    toggleProfileDrawer();
    const modal = document.getElementById('avatarWordModal');
    const input = document.getElementById('avatarWordPromptInput');
    if (input) input.value = currentAvatarSeed;
    if (modal) modal.classList.remove('hidden');
    if (input) {
        setTimeout(() => input.focus(), 100);
    }
}

function closeAvatarWordModal() {
    const modal = document.getElementById('avatarWordModal');
    if (modal) modal.classList.add('hidden');
}

function confirmAvatarWordPrompt() {
    const input = document.getElementById('avatarWordPromptInput');
    if (!input || !input.value.trim()) return;
    const newWord = input.value.trim();

    currentAvatarCustomUrl = null;
    localStorage.removeItem('cine_avatar_custom_url');
    currentAvatarSeed = newWord;
    window.currentAvatarSeed = currentAvatarSeed;
    localStorage.setItem('cine_avatar_seed', currentAvatarSeed);
    if (window.fbSaveProfile) window.fbSaveProfile({ avatarSeed: currentAvatarSeed });
    updateProfileDrawerStats();
    closeAvatarWordModal();
}

window.onload = async () => {
    refreshRoulette();
    renderCustomLists();
    updateProfileDrawerStats();

    switchMainTab(defaultMainTab);
    renderMuralFeed('all');

    const oscarDetails = document.getElementById('oscarDetails');
    if (oscarDetails) {
        oscarDetails.addEventListener('toggle', () => {
            if (oscarDetails.open && !_oscarsInitialized) {
                _oscarsInitialized = true;
                loadOscarMovies();
            }
        });
    }

    makeModalDraggable('detailModal', 'detailModalHeader');
    makeModalDraggable('smartPublishModal', 'smartPublishHeader');
    makeModalDraggable('winnerModal', 'winnerModalHeader');
    makeModalDraggable('settingsModal', 'settingsHeader');
    makeModalDraggable('exportCardModal', 'exportCardHeader');

    const resultsGridEl = document.getElementById('resultsGrid');
    if (resultsGridEl) {
        resultsGridEl.addEventListener('scroll', () => {
            if (isLoadingMore) return;
            if (resultsGridEl.scrollTop + resultsGridEl.clientHeight >= resultsGridEl.scrollHeight - 150) {
                loadNextFilteredPageAutomatically();
            }
        });
    }
};

// ===== CONSULTAS TMDb (CON PROXY VERCEL, DEDUPLICACIÓN Y CACHÉ) =====
const _tmdbCache = new Map();
const _tmdbInFlight = new Map();
let _catalogReq = 0;

async function fetchFromTMDb(endpoint) {
    const hit = _tmdbCache.get(endpoint);
    if (hit && Date.now() - hit.t < 15 * 60 * 1000) return hit.v;
    if (_tmdbInFlight.has(endpoint)) return _tmdbInFlight.get(endpoint);

    const task = (async () => {
        try {
            const isLocalEnv = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            const localTok = window.LOCAL_TMDB_TOKEN ? String(window.LOCAL_TMDB_TOKEN).trim().replace(/^["']+|["';]+$/g, '') : '';
            const useLocalToken = isLocalEnv && !!localTok;
            const isLocalBearer = localTok.startsWith('eyJ') || localTok.length > 60;
            const sep = endpoint.includes('?') ? '&' : '?';
            const url = useLocalToken
                ? (isLocalBearer ? `https://api.themoviedb.org/3${endpoint}` : `https://api.themoviedb.org/3${endpoint}${sep}api_key=${encodeURIComponent(localTok)}`)
                : `${TMDB_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}`;
            const headers = (useLocalToken && isLocalBearer)
                ? { 'Authorization': `Bearer ${localTok}`, 'Content-Type': 'application/json;charset=utf-8' }
                : { 'Accept': 'application/json' };

            let response = await fetch(url, { method: 'GET', headers });
            if (!response.ok && useLocalToken) {
                const proxyUrl = `${TMDB_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}`;
                response = await fetch(proxyUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
            }
            if (!response.ok) throw new Error("Error en TMDb API");
            const json = await response.json();
            _tmdbCache.set(endpoint, { t: Date.now(), v: json });
            return json;
        } catch (err) {
            return null;
        } finally {
            _tmdbInFlight.delete(endpoint);
        }
    })();

    _tmdbInFlight.set(endpoint, task);
    return task;
}

async function fetchDualLanguageMovie(endpoint) {
    try {
        const isTv = endpoint.startsWith('/tv/');
        const sep = endpoint.includes('?') ? '&' : '?';
        const sameLang = currentLang === currentTitleLang;
        const dataOverviewP = fetchFromTMDb(`${endpoint}${sep}language=${currentLang}`);
        const dataTitleP = sameLang ? dataOverviewP : fetchFromTMDb(`${endpoint}${sep}language=${currentTitleLang}`);
        const [dataOverview, dataTitle] = await Promise.all([dataOverviewP, dataTitleP]);

        if (!dataOverview) return null;

        const mainTitle = isTv
            ? ((dataTitle && (dataTitle.name || dataTitle.original_name)) ? (dataTitle.name || dataTitle.original_name) : (dataOverview.name || dataOverview.original_name))
            : ((dataTitle && (dataTitle.title || dataTitle.original_title)) ? (dataTitle.title || dataTitle.original_title) : (dataOverview.title || dataOverview.original_title));

        const subTitle = isTv
            ? (dataOverview.name || dataOverview.original_name)
            : (dataOverview.title || dataOverview.original_title);
        const posterPath = (dataTitle && dataTitle.poster_path) ? dataTitle.poster_path : dataOverview.poster_path;
        const dateStr = isTv ? dataOverview.first_air_date : dataOverview.release_date;

        const out = {
            id: isTv ? `tv_${dataOverview.id}` : dataOverview.id,
            title: mainTitle,
            subtitle: subTitle !== mainTitle ? subTitle : '',
            rating: dataOverview.vote_average ? dataOverview.vote_average.toFixed(1) : '8.0',
            votes: dataOverview.vote_count > 1000 ? (dataOverview.vote_count / 1000).toFixed(0) + 'k' : (dataOverview.vote_count || 0),
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : POSTER_FALLBACK,
            overview: dataOverview.overview || 'Sin descripción disponible.',
            year: dateStr ? dateStr.split('-')[0] : 'N/A'
        };
        if (isTv) {
            out.mediaType = 'tv';
            out.number_of_seasons = dataOverview.number_of_seasons || 0;
            out.number_of_episodes = dataOverview.number_of_episodes || 0;
            out.seasons = Array.isArray(dataOverview.seasons) ? dataOverview.seasons : [];
        }
        return out;
    } catch (err) {
        return null;
    }
}

async function fetchTvSeasonDual(tmdbId, seasonNumber) {
    try {
        const endpoint = `/tv/${tmdbId}/season/${seasonNumber}`;
        const sameLang = currentLang === currentTitleLang;
        const dataOverviewP = fetchFromTMDb(`${endpoint}?language=${currentLang}`);
        const dataTitleP = sameLang ? dataOverviewP : fetchFromTMDb(`${endpoint}?language=${currentTitleLang}`);
        const [dataOverview, dataTitle] = await Promise.all([dataOverviewP, dataTitleP]);
        if (!dataOverview) return null;
        if (!dataOverview.overview && dataTitle && dataTitle.overview) {
            dataOverview.overview = dataTitle.overview;
        }
        if (Array.isArray(dataOverview.episodes) && dataTitle && Array.isArray(dataTitle.episodes)) {
            const byEp = new Map(dataTitle.episodes.map(ep => [ep.episode_number, ep]));
            dataOverview.episodes = dataOverview.episodes.map(ep => {
                const tEp = byEp.get(ep.episode_number);
                return {
                    ...ep,
                    name: ep.name || (tEp && tEp.name) || `Capítulo ${ep.episode_number}`,
                    overview: ep.overview || (tEp && tEp.overview) || ''
                };
            });
        }
        return dataOverview;
    } catch (err) {
        return null;
    }
}

async function fetchSearchMovieDual(query) {
    const encoded = encodeURIComponent(query.trim());
    const sameLang = currentLang === currentTitleLang;
    const movieInterfaceP = fetchFromTMDb(`/search/movie?query=${encoded}&language=${currentLang}`);
    const movieTitleP = sameLang ? movieInterfaceP : fetchFromTMDb(`/search/movie?query=${encoded}&language=${currentTitleLang}`);
    const tvInterfaceP = fetchFromTMDb(`/search/tv?query=${encoded}&language=${currentLang}`);
    const tvTitleP = sameLang ? tvInterfaceP : fetchFromTMDb(`/search/tv?query=${encoded}&language=${currentTitleLang}`);
    const [mInterface, mTitle, tvInterface, tvTitle] = await Promise.all([movieInterfaceP, movieTitleP, tvInterfaceP, tvTitleP]);

    const movies = (mInterface && Array.isArray(mInterface.results)) ? mInterface.results.map(m => {
        const titleMatch = mTitle && mTitle.results ? mTitle.results.find(t => t.id === m.id) : null;
        const titleMain = titleMatch ? (titleMatch.title || titleMatch.original_title) : (m.title || m.original_title);
        const titleSub = (m.title || m.original_title);
        const posterPath = (titleMatch && titleMatch.poster_path) ? titleMatch.poster_path : m.poster_path;

        return {
            id: m.id,
            mediaType: 'movie',
            title: titleMain,
            subtitle: titleSub !== titleMain ? titleSub : '',
            rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
            votes: m.vote_count > 1000 ? (m.vote_count / 1000).toFixed(0) + 'k' : (m.vote_count || 0),
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : POSTER_FALLBACK,
            overview: m.overview || 'Sin descripción disponible.',
            year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
            _pop: (m.popularity || 0) + ((m.vote_count || 0) > 50 ? 15 : 0)
        };
    }) : [];

    const tvShows = (tvInterface && Array.isArray(tvInterface.results)) ? tvInterface.results.map(t => {
        const titleMatch = tvTitle && tvTitle.results ? tvTitle.results.find(x => x.id === t.id) : null;
        const titleMain = titleMatch ? (titleMatch.name || titleMatch.original_name) : (t.name || t.original_name);
        const titleSub = (t.name || t.original_name);
        const posterPath = (titleMatch && titleMatch.poster_path) ? titleMatch.poster_path : t.poster_path;

        return {
            id: `tv_${t.id}`,
            mediaType: 'tv',
            title: titleMain,
            subtitle: titleSub !== titleMain ? titleSub : '',
            rating: t.vote_average ? t.vote_average.toFixed(1) : 'N/A',
            votes: t.vote_count > 1000 ? (t.vote_count / 1000).toFixed(0) + 'k' : (t.vote_count || 0),
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : POSTER_FALLBACK,
            overview: t.overview || 'Sin descripción disponible.',
            year: t.first_air_date ? t.first_air_date.split('-')[0] : 'N/A',
            _pop: (t.popularity || 0) + ((t.vote_count || 0) > 50 ? 15 : 0)
        };
    }) : [];

    // Priorizar el modo activo en el catálogo pero mostrando ambos (Películas y Series TV)
    const combined = [...movies, ...tvShows].sort((a, b) => (b._pop || 0) - (a._pop || 0));
    return combined;
}

const MOVIE_GENRES_HTML = `
    <option value="">Cualquier género</option>
    <option value="28">Acción</option>
    <option value="12">Aventura</option>
    <option value="16">Animación</option>
    <option value="35">Comedia</option>
    <option value="80">Crimen</option>
    <option value="99">Documental</option>
    <option value="18">Drama</option>
    <option value="14">Fantasía</option>
    <option value="27">Terror</option>
    <option value="9648">Misterio</option>
    <option value="10749">Romance</option>
    <option value="878">Ciencia ficción</option>
    <option value="53">Suspense / Thriller</option>
`;

const TV_GENRES_HTML = `
    <option value="">Cualquier género (Series)</option>
    <option value="10759">Acción y Aventura</option>
    <option value="16">Animación</option>
    <option value="35">Comedia</option>
    <option value="80">Crimen</option>
    <option value="99">Documental</option>
    <option value="18">Drama</option>
    <option value="9648">Misterio</option>
    <option value="10765">Sci-Fi y Fantasía</option>
    <option value="10768">Bélico y Política</option>
    <option value="37">Western</option>
`;

function setCatalogMediaType(mode) {
    catalogMediaType = mode === 'tv' ? 'tv' : 'movie';
    const mBtn = document.getElementById('catalogModeMoviesBtn');
    const tvBtn = document.getElementById('catalogModeTvBtn');
    const activeCls = "px-3 py-1 bg-rose-900 text-stone-100 font-bold uppercase tracking-wider transition cursor-pointer";
    const inactiveCls = "px-3 py-1 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 uppercase tracking-wider transition cursor-pointer";
    if (mBtn) mBtn.className = catalogMediaType === 'movie' ? activeCls : inactiveCls;
    if (tvBtn) tvBtn.className = catalogMediaType === 'tv' ? activeCls : inactiveCls;

    const genreSelect = document.getElementById('genreSelect');
    if (genreSelect) {
        genreSelect.innerHTML = catalogMediaType === 'tv' ? TV_GENRES_HTML : MOVIE_GENRES_HTML;
        genreSelect.value = '';
    }

    const oscarTitle = document.getElementById('oscarSectionTitle');
    if (oscarTitle) {
        oscarTitle.textContent = catalogMediaType === 'tv' ? 'Series de Culto y Premios Emmy' : 'Archivo de la Academia (Óscars)';
    }

    resetAndFetchFilteredMovies();
    if (_oscarsInitialized) loadOscarMovies();
}

function resetAndFetchFilteredMovies() {
    _catalogInitialized = true;
    currentFilterPage = 3;
    fetchedResults = [];
    fetchMultipleFilteredPages();
}

function _mapCatalogItem(mEs, mTitle, isTv) {
    const posterPath = (mTitle && mTitle.poster_path) || mEs.poster_path;
    const mainTitle = isTv
        ? ((mTitle && (mTitle.name || mTitle.original_name)) || mEs.name || mEs.original_name)
        : ((mTitle && (mTitle.title || mTitle.original_title)) || mEs.title || mEs.original_title);
    const subTitle = isTv
        ? (mEs.name || mEs.original_name)
        : (mEs.title || mEs.original_title);
    const dateStr = isTv ? mEs.first_air_date : mEs.release_date;
    return {
        id: isTv ? `tv_${mEs.id}` : mEs.id,
        mediaType: isTv ? 'tv' : 'movie',
        title: mainTitle,
        subtitle: subTitle !== mainTitle ? subTitle : '',
        rating: mEs.vote_average ? mEs.vote_average.toFixed(1) : 'N/A',
        votes: mEs.vote_count > 1000 ? (mEs.vote_count / 1000).toFixed(0) + 'k' : (mEs.vote_count || 0),
        poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : POSTER_FALLBACK,
        overview: mEs.overview || 'Sin descripción disponible.',
        year: dateStr ? dateStr.split('-')[0] : 'N/A'
    };
}

async function fetchMultipleFilteredPages() {
    const isTv = catalogMediaType === 'tv';
    const genre = document.getElementById('genreSelect').value;
    const minRating = parseFloat(document.getElementById('minRatingInput').value);
    const maxRating = parseFloat(document.getElementById('maxRatingInput').value);
    let baseSortBy = document.getElementById('sortBySelect').value;
    if (isTv && baseSortBy === 'primary_release_date') baseSortBy = 'first_air_date';
    const sortBy = `${baseSortBy}.${sortDirection}`;
    const minVotes = document.getElementById('minVotes').value;

    const discoverPath = isTv ? '/discover/tv' : '/discover/movie';
    let baseEs = `${discoverPath}?language=${currentLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}`;
    let baseTitle = `${discoverPath}?language=${currentTitleLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}`;
    if (genre) { baseEs += `&with_genres=${genre}`; baseTitle += `&with_genres=${genre}`; }

    const pages = [1, 2, 3];
    const myReq = ++_catalogReq;
    const sameLang = currentLang === currentTitleLang;
    const pEs = Promise.all(pages.map(p => fetchFromTMDb(`${baseEs}&page=${p}`)));
    const pTitle = sameLang ? pEs : Promise.all(pages.map(p => fetchFromTMDb(`${baseTitle}&page=${p}`)));
    const [responsesEs, responsesTitle] = await Promise.all([pEs, pTitle]);
    if (myReq !== _catalogReq) return;

    fetchedResults = [];
    responsesEs.forEach((dataEs, index) => {
        if (dataEs && dataEs.results) {
            if (index === 0) totalFilterPages = dataEs.total_pages || 1;
            const titleRes = (responsesTitle[index] && responsesTitle[index].results) ? responsesTitle[index].results : [];
            const mapped = dataEs.results.map((mEs, i) => _mapCatalogItem(mEs, titleRes[i] || mEs, isTv));
            fetchedResults = [...fetchedResults, ...mapped];
        }
    });

    renderResultsGrid();
    updateCatalogCount();
}

async function loadNextFilteredPageAutomatically() {
    if (isLoadingMore) return;
    if (currentFilterPage >= totalFilterPages) return;

    isLoadingMore = true;
    const nextPages = [currentFilterPage + 1, currentFilterPage + 2];
    currentFilterPage += 2;

    await fetchMultipleFilteredPagesForScroll(nextPages);

    setTimeout(() => {
        isLoadingMore = false;
    }, 600);
}

async function fetchMultipleFilteredPagesForScroll(pagesArray) {
    const isTv = catalogMediaType === 'tv';
    const genre = document.getElementById('genreSelect').value;
    const minRating = parseFloat(document.getElementById('minRatingInput').value);
    const maxRating = parseFloat(document.getElementById('maxRatingInput').value);
    let baseSortBy = document.getElementById('sortBySelect').value;
    if (isTv && baseSortBy === 'primary_release_date') baseSortBy = 'first_air_date';
    const sortBy = `${baseSortBy}.${sortDirection}`;
    const minVotes = document.getElementById('minVotes').value;

    const discoverPath = isTv ? '/discover/tv' : '/discover/movie';
    let baseEs = `${discoverPath}?language=${currentLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}`;
    let baseTitle = `${discoverPath}?language=${currentTitleLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}`;
    if (genre) { baseEs += `&with_genres=${genre}`; baseTitle += `&with_genres=${genre}`; }

    const sameLang = currentLang === currentTitleLang;
    const pEs = Promise.all(pagesArray.map(p => fetchFromTMDb(`${baseEs}&page=${p}`)));
    const pTitle = sameLang ? pEs : Promise.all(pagesArray.map(p => fetchFromTMDb(`${baseTitle}&page=${p}`)));
    const [responsesEs, responsesTitle] = await Promise.all([pEs, pTitle]);

    responsesEs.forEach((dataEs, index) => {
        if (dataEs && dataEs.results) {
            const titleRes = (responsesTitle[index] && responsesTitle[index].results) ? responsesTitle[index].results : [];
            const mapped = dataEs.results.map((mEs, i) => _mapCatalogItem(mEs, titleRes[i] || mEs, isTv));
            fetchedResults = [...fetchedResults, ...mapped];
        }
    });

    renderResultsGrid();
    updateCatalogCount();
}

function renderResultsGrid() {
    const container = document.getElementById('resultsGrid');
    if (!container) return;
    container.innerHTML = '';

    getVisibleCatalogMovies().forEach(movie => {
        const isWatched = watchedMovies.includes(movie.id);
        const pReview = personalReviews[movie.id];
        const personalRating = pReview && pReview.rating ? pReview.rating : null;
        const isTv = movie.mediaType === 'tv' || String(movie.id).startsWith('tv_');
        const epSeenCount = isTv && Array.isArray(watchedEpisodes[movie.id]) ? watchedEpisodes[movie.id].length : 0;

        const tmdbBadgeHtml = `<span class="bg-stone-900/85 backdrop-blur-md text-stone-100 px-1.5 py-0.5 text-[10px] font-mono journal-border shadow-md flex items-center space-x-1"><i class="fa-solid fa-star text-amber-500"></i><span>${movie.rating}</span></span>`;
        const tvBadgeHtml = isTv
            ? `<span class="bg-amber-700/90 backdrop-blur-md text-stone-100 px-1.5 py-0.5 text-[9px] font-mono journal-border shadow-md uppercase tracking-wider"><i class="fa-solid fa-tv mr-0.5"></i>Serie${epSeenCount > 0 ? ` · ${epSeenCount} cap.` : ''}</span>`
            : '';
        const personalBadgeHtml = personalRating !== null
            ? `<span class="bg-rose-900/90 backdrop-blur-md text-stone-100 px-1.5 py-0.5 text-[10px] font-mono journal-border shadow-md flex items-center space-x-1" title="Tu nota personal"><i class="fa-solid fa-feather text-amber-300"></i><span>${Number(personalRating).toFixed(1)} (Tú)</span></span>`
            : '';

        const subTitleHtml = (movie.subtitle && movie.subtitle.trim() !== '')
            ? `<span class="block text-[10px] font-mono text-stone-500 truncate">${_pmEsc(movie.subtitle)}</span>`
            : '';

        const card = document.createElement('div');
        card.className = `bg-stone-50 dark:bg-stone-900 journal-border p-2.5 flex flex-col justify-between transition group relative cursor-pointer shadow-sm ${isWatched ? 'opacity-60' : 'hover:border-rose-900'}`;
        card.onclick = (e) => { if (!e.target.closest('button')) openDetailModal(movie, isTv ? "Serie del catálogo" : "Reseña de catálogo"); };

        card.innerHTML = `
            <div class="relative aspect-[2/3] w-full overflow-hidden journal-border bg-stone-200 dark:bg-stone-950 mb-2">
                <img src="${_pmEsc(thumbPoster(movie.poster, 'w342'))}" loading="lazy" decoding="async" onerror="this.src='${POSTER_FALLBACK}'" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <div class="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">${tmdbBadgeHtml}${tvBadgeHtml}</div>
                <div class="absolute bottom-2 left-2 z-10">${personalBadgeHtml}</div>
                <button onclick="event.stopPropagation(); toggleWatchedStatus('${_pmEsc(movie.id)}'); renderResultsGrid();" 
                    class="absolute top-2 right-2 z-10 p-1.5 bg-stone-900/80 hover:bg-rose-900 text-stone-100 journal-border text-xs transition shadow-md cursor-pointer ${isWatched ? '!bg-emerald-800' : ''}" 
                    title="${isWatched ? 'Marcar como no vista' : 'Marcar como vista'}">
                    <i class="fa-${isWatched ? 'solid' : 'regular'} fa-eye"></i>
                </button>
            </div>
            <div class="space-y-1">
                <h5 class="text-xs font-serif font-semibold truncate group-hover:text-rose-800 dark:group-hover:text-rose-400 transition">${_pmEsc(movie.title)}</h5>
                ${subTitleHtml}
                <div class="flex items-center justify-between pt-1 border-t border-stone-200 dark:border-stone-800 text-[10px] font-mono text-stone-400">
                    <span>${movie.year || 'N/A'}</span>
                    <span>${movie.votes} votos</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    updateCatalogCount();
}

function handleRangeInput() {
    const minInput = document.getElementById('minRatingInput');
    const maxInput = document.getElementById('maxRatingInput');
    const minValSpan = document.getElementById('minRatingVal');
    const maxValSpan = document.getElementById('maxRatingVal');

    if (!minInput || !maxInput) return;

    let minVal = parseFloat(minInput.value);
    let maxVal = parseFloat(maxInput.value);

    if (minVal > maxVal) {
        minInput.value = maxVal;
        minVal = maxVal;
    }

    if (minValSpan) minValSpan.innerText = minVal.toFixed(1);
    if (maxValSpan) maxValSpan.innerText = maxVal.toFixed(1);
}

let sliderDebounceTimer = null;
function debounceFetchFilteredMovies() {
    clearTimeout(sliderDebounceTimer);
    sliderDebounceTimer = setTimeout(() => {
        resetAndFetchFilteredMovies();
    }, 400);
}

async function loadOscarMovies() {
    _oscarsInitialized = true;
    const isTv = catalogMediaType === 'tv';
    const sourceDB = isTv ? EMMY_TV_DATABASE : OSCAR_DATABASE;
    const filteredDB = sourceDB.filter(m => oscarMode === 'WINNERS' ? m.isWinner : true);
    const results = await Promise.all(filteredDB.slice(0, 10).map(async (item) => {
        const movie = await fetchDualLanguageMovie(isTv ? `/tv/${item.tmdbId}` : `/movie/${item.tmdbId}`);
        if (movie) { movie.oscarYear = item.oscarYear; movie.isWinner = item.isWinner; return movie; }
        return null;
    }));
    currentOscarList = results.filter(m => m !== null);
    renderOscarList();
}

function handleAutocompleteInput(query) {
    clearTimeout(autocompleteDebounceTimer);
    const spinner = document.getElementById('autocompleteSpinner');
    const dropdown = document.getElementById('autocompleteDropdown');

    if (!query || query.trim() === '') {
        if (dropdown) dropdown.classList.add('hidden');
        if (spinner) spinner.classList.add('hidden');
        resetAndFetchFilteredMovies();
        return;
    }

    if (spinner) spinner.classList.remove('hidden');

    autocompleteDebounceTimer = setTimeout(async () => {
        const results = await fetchSearchMovieDual(query);
        if (spinner) spinner.classList.add('hidden');

        if (results && results.length > 0) {
            if (dropdown) {
                dropdown.innerHTML = '';
                results.slice(0, 6).forEach(m => {
                    const isTv = m.mediaType === 'tv' || String(m.id).startsWith('tv_');
                    const badge = isTv
                        ? `<span class="text-[9px] font-mono uppercase px-1 py-0.2 bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-600/40 font-bold">📺 Serie</span>`
                        : `<span class="text-[9px] font-mono uppercase px-1 py-0.2 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400">🎬 Película</span>`;
                    const item = document.createElement('div');
                    item.className = "flex items-center space-x-3 p-2 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer transition border-b border-stone-200 dark:border-stone-800 last:border-b-0";
                    item.innerHTML = `
                        <img src="${_pmEsc(thumbPoster(m.poster, 'w185'))}" loading="lazy" decoding="async" onerror="this.src='${POSTER_FALLBACK}'" class="w-8 h-12 object-cover journal-border flex-shrink-0">
                        <div class="overflow-hidden flex-grow">
                            <div class="flex items-center gap-1.5">${badge}<h5 class="text-xs font-serif font-bold truncate">${_pmEsc(m.title)} (${m.year})</h5></div>
                            ${m.subtitle ? `<span class="block text-[10px] font-serif text-stone-500 truncate">${_pmEsc(m.subtitle)}</span>` : ''}
                            <span class="text-[10px] font-mono text-stone-500"><i class="fa-solid fa-star text-amber-500"></i> ${m.rating}</span>
                        </div>
                    `;
                    item.onclick = () => {
                        dropdown.classList.add('hidden');
                        document.getElementById('manualMovieInput').value = m.title;
                        openDetailModal(m, "Búsqueda directa");
                    };
                    dropdown.appendChild(item);
                });
                dropdown.classList.remove('hidden');
            }
        } else {
            if (dropdown) {
                dropdown.innerHTML = `<div class="p-3 text-xs font-serif italic text-stone-400 text-center">No se encontraron obras.</div>`;
                dropdown.classList.remove('hidden');
            }
        }
    }, 400);
}

// ===== MODAL DE PUBLICACIÓN INTELIGENTE =====
let currentPublishMode = 'review';
let modalAutocompleteTimer = null;
let cachedSelectedMovieObj = null;
let _smartTvState = {
    baseMovieObj: null,
    tmdbId: 0,
    baseId: '',
    seasons: [],
    episodesBySeason: {}
};

function toggleRedactionMenu(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('redactionDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

window.addEventListener('click', () => {
    const dropdown = document.getElementById('redactionDropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
    }
});

function clearModalMovieSelection() {
    const searchInput = document.getElementById('modalMovieSearchInput');
    if (searchInput) searchInput.value = '';
    const selectedIdInput = document.getElementById('selectedTmdbMovieId');
    if (selectedIdInput) selectedIdInput.value = '';
    const previewBox = document.getElementById('selectedMoviePreview');
    if (previewBox) previewBox.classList.add('hidden');
    const tvScopeBox = document.getElementById('smartTvScopeBox');
    if (tvScopeBox) tvScopeBox.classList.add('hidden');
    const epSelect = document.getElementById('smartEpisodeSelect');
    if (epSelect) { epSelect.classList.add('hidden'); epSelect.innerHTML = '<option value="">Toda la temporada seleccionada</option>'; }
    const dropdown = document.getElementById('modalMovieDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    cachedSelectedMovieObj = null;
    _smartTvState = { baseMovieObj: null, tmdbId: 0, baseId: '', seasons: [], episodesBySeason: {} };
}

async function onSmartSeasonChange(seasonVal) {
    const base = _smartTvState.baseMovieObj;
    if (!base) return;
    const epSelect = document.getElementById('smartEpisodeSelect');
    const selectedIdInput = document.getElementById('selectedTmdbMovieId');
    if (!seasonVal) {
        if (epSelect) epSelect.classList.add('hidden');
        if (selectedIdInput) selectedIdInput.value = _smartTvState.baseId;
        cachedSelectedMovieObj = { ...base, id: _smartTvState.baseId, mediaType: 'tv', scopeLabel: undefined };
        return;
    }

    const sNum = Number(seasonVal);
    const targetId = `${_smartTvState.baseId}_s${sNum}`;
    if (selectedIdInput) selectedIdInput.value = targetId;
    const sObj = (_smartTvState.seasons || []).find(s => Number(s.season_number) === sNum);
    const sPoster = (sObj && sObj.poster_path) ? `https://image.tmdb.org/t/p/w500${sObj.poster_path}` : base.poster;
    cachedSelectedMovieObj = {
        ...base,
        id: targetId,
        poster: sPoster,
        mediaType: 'tv',
        scopeLabel: `Temporada ${sNum}`
    };

    if (epSelect) {
        epSelect.classList.remove('hidden');
        epSelect.innerHTML = `<option value="">Cargando capítulos de Temporada ${sNum}...</option>`;
        const seasonData = await fetchTvSeasonDual(_smartTvState.tmdbId, sNum);
        const eps = (seasonData && Array.isArray(seasonData.episodes)) ? seasonData.episodes : [];
        _smartTvState.episodesBySeason[sNum] = eps;
        epSelect.innerHTML = `<option value="">📂 Toda la Temporada ${sNum}</option>` +
            eps.map(ep => `<option value="${ep.episode_number}">🎬 E${ep.episode_number}: ${_pmEsc(ep.name || 'Capítulo ' + ep.episode_number)}</option>`).join('');
    }
}

function onSmartEpisodeChange(epVal) {
    const base = _smartTvState.baseMovieObj;
    if (!base) return;
    const seasonSelect = document.getElementById('smartSeasonSelect');
    const selectedIdInput = document.getElementById('selectedTmdbMovieId');
    const sNum = seasonSelect ? Number(seasonSelect.value) : 0;
    if (!sNum) return;

    if (!epVal) {
        const targetId = `${_smartTvState.baseId}_s${sNum}`;
        if (selectedIdInput) selectedIdInput.value = targetId;
        cachedSelectedMovieObj = {
            ...base,
            id: targetId,
            mediaType: 'tv',
            scopeLabel: `Temporada ${sNum}`
        };
        return;
    }

    const eNum = Number(epVal);
    const eps = _smartTvState.episodesBySeason[sNum] || [];
    const epObj = eps.find(x => Number(x.episode_number) === eNum);
    const epName = epObj && epObj.name ? `: ${epObj.name}` : '';
    const scopeLabel = `T${sNum}·E${eNum}${epName}`.slice(0, 90);
    const targetId = `${_smartTvState.baseId}_s${sNum}_e${eNum}`;
    if (selectedIdInput) selectedIdInput.value = targetId;
    cachedSelectedMovieObj = {
        ...base,
        id: targetId,
        mediaType: 'tv',
        scopeLabel
    };
}

function openRedactionChoice(mode) {
    resetModalPosition('smartPublishModal');
    currentPublishMode = mode;
    const modal = document.getElementById('smartPublishModal');
    const titleEl = document.getElementById('smartModalTitle');
    const movieContainer = document.getElementById('movieSelectContainer');
    const ratingContainer = document.getElementById('ratingContainer');
    const titleLabel = document.getElementById('titleFieldLabel');
    const titleInput = document.getElementById('smartPostTitle');
    const wallCheckWrap = document.getElementById('wallPublishCheckWrap');
    const wallCheck = document.getElementById('wallPublishCheck');

    const form = document.getElementById('smartPublishForm');
    if (form) form.reset();

    // Limpieza garantizada de cualquier selección previa (evita que quede pegada una película anterior)
    clearModalMovieSelection();
    window._smartSet = mountStars('smartStarContainer', 'smartStarText', 0, v => {
        const h = document.getElementById('smartPostRating');
        if (h) h.value = v || '';
    });
    const hRating = document.getElementById('smartPostRating');
    if (hRating) hRating.value = '';
    if (wallCheck) wallCheck.checked = true;

    if (mode === 'review') {
        if (titleEl) titleEl.innerText = "✍️ Redactar reseña (Película o Serie TV)";
        if (movieContainer) movieContainer.classList.remove('hidden');
        if (ratingContainer) ratingContainer.classList.remove('hidden');
        if (wallCheckWrap) wallCheckWrap.classList.remove('hidden');
        if (titleLabel) titleLabel.innerText = "Titular de la reseña (Opcional)";
        if (titleInput) titleInput.removeAttribute('required');
    } else {
        if (titleEl) titleEl.innerText = "💬 Abrir debate en el muro";
        if (movieContainer) movieContainer.classList.add('hidden');
        if (ratingContainer) ratingContainer.classList.add('hidden');
        if (wallCheckWrap) wallCheckWrap.classList.add('hidden');
        if (titleLabel) titleLabel.innerText = "Pregunta o tema del debate";
        if (titleInput) titleInput.setAttribute('required', 'true');
    }

    if (modal) modal.classList.remove('hidden');
}

function closeSmartPublishModal() {
    clearModalMovieSelection();
    const modal = document.getElementById('smartPublishModal');
    if (modal) modal.classList.add('hidden');
}

function handleModalMovieAutocomplete(query) {
    clearTimeout(modalAutocompleteTimer);
    const dropdown = document.getElementById('modalMovieDropdown');

    if (!query || query.trim() === '') {
        if (dropdown) dropdown.classList.add('hidden');
        return;
    }

    modalAutocompleteTimer = setTimeout(async () => {
        const results = await fetchSearchMovieDual(query);

        if (results && results.length > 0) {
            if (dropdown) {
                dropdown.innerHTML = '';
                results.slice(0, 6).forEach(m => {
                    const isTv = m.mediaType === 'tv' || String(m.id).startsWith('tv_');
                    const badge = isTv
                        ? `<span class="text-[9px] font-mono uppercase px-1 py-0.2 bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-600/40 font-bold">📺 Serie</span>`
                        : `<span class="text-[9px] font-mono uppercase px-1 py-0.2 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400">🎬 Película</span>`;
                    const item = document.createElement('div');
                    item.className = "flex items-center space-x-2 p-2 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer transition border-b border-stone-200 dark:border-stone-800 last:border-b-0 text-xs";
                    item.innerHTML = `
                        <img src="${_pmEsc(thumbPoster(m.poster, 'w185'))}" loading="lazy" decoding="async" onerror="this.src='${POSTER_FALLBACK}'" class="w-7 h-10 object-cover journal-border flex-shrink-0">
                        <div class="overflow-hidden flex-grow">
                            <div class="flex items-center gap-1.5">${badge}<span class="block font-serif font-bold truncate">${_pmEsc(m.title)} (${m.year})</span></div>
                            ${m.subtitle ? `<span class="block text-[10px] font-serif text-stone-500 truncate">${_pmEsc(m.subtitle)}</span>` : ''}
                        </div>
                    `;
                    item.onclick = async () => {
                        document.getElementById('modalMovieSearchInput').value = `${m.title} (${m.year})`;
                        document.getElementById('selectedTmdbMovieId').value = m.id;
                        cachedSelectedMovieObj = {
                            id: m.id,
                            mediaType: isTv ? 'tv' : 'movie',
                            title: m.title,
                            subtitle: m.subtitle || '',
                            poster: m.poster,
                            rating: m.rating,
                            overview: m.overview,
                            year: m.year
                        };

                        const previewBox = document.getElementById('selectedMoviePreview');
                        const posterImg = document.getElementById('previewMoviePoster');
                        const titleTxt = document.getElementById('previewMovieTitle');
                        const overviewTxt = document.getElementById('previewMovieOverview');
                        const tvScopeBox = document.getElementById('smartTvScopeBox');
                        const seasonSelect = document.getElementById('smartSeasonSelect');
                        const epSelect = document.getElementById('smartEpisodeSelect');

                        if (previewBox && posterImg && titleTxt && overviewTxt) {
                            posterImg.src = safePoster(m.poster);
                            titleTxt.innerHTML = `${isTv ? '<span class="text-[9px] font-mono uppercase px-1 py-0.5 bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-600/40 mr-1">📺 Serie</span>' : ''}${_pmEsc(m.title)} (${m.year}) ${m.subtitle ? `<span class="block text-[10px] text-stone-500 font-normal italic mt-0.5">${_pmEsc(m.subtitle)}</span>` : ''}`;
                            overviewTxt.innerText = m.overview;
                            previewBox.classList.remove('hidden');
                        }

                        dropdown.classList.add('hidden');

                        if (isTv && tvScopeBox && seasonSelect) {
                            const parsed = _parseMediaId(m.id);
                            _smartTvState = {
                                baseMovieObj: { ...cachedSelectedMovieObj },
                                tmdbId: parsed.tmdbId,
                                baseId: parsed.baseId,
                                seasons: [],
                                episodesBySeason: {}
                            };
                            if (epSelect) epSelect.classList.add('hidden');
                            seasonSelect.innerHTML = `<option value="">📺 Serie completa (cargando temporadas...)</option>`;
                            tvScopeBox.classList.remove('hidden');

                            const fullTv = await fetchDualLanguageMovie(`/tv/${parsed.tmdbId}`);
                            if (fullTv && Array.isArray(fullTv.seasons)) {
                                const validSeasons = fullTv.seasons.filter(s => s && s.season_number > 0);
                                _smartTvState.seasons = validSeasons;
                                seasonSelect.innerHTML = `<option value="">📺 Serie completa (${validSeasons.length} temp.)</option>` +
                                    validSeasons.map(s => `<option value="${s.season_number}">📂 Temporada ${s.season_number} (${s.episode_count || 0} cap.)</option>`).join('');
                            } else {
                                seasonSelect.innerHTML = `<option value="">📺 Serie completa</option>`;
                            }
                        } else if (tvScopeBox) {
                            tvScopeBox.classList.add('hidden');
                        }
                    };
                    dropdown.appendChild(item);
                });
                dropdown.classList.remove('hidden');
            }
        } else {
            if (dropdown) {
                dropdown.innerHTML = `<div class="p-2 text-xs font-serif italic text-stone-400 text-center">No se encontró ninguna película ni serie.</div>`;
                dropdown.classList.remove('hidden');
            }
        }
    }, 400);
}

// Cerrar cualquier modal al hacer clic en su fondo oscuro exterior
document.addEventListener('click', (e) => {
    const modalIds = [
        'detailModal',
        'winnerModal',
        'settingsModal',
        'smartPublishModal',
        'avatarWordModal',
        'muralPostModal',
        'userProfileModal',
        'customConfirmModal',
        'exportCardModal'
    ];

    if (modalIds.includes(e.target.id)) {
        if (e.target.id === 'smartPublishModal') closeSmartPublishModal();
        else if (e.target.id === 'muralPostModal') closeMuralPostModal();
        else if (e.target.id === 'exportCardModal') closeExportCardModal();
        else e.target.classList.add('hidden');
    }
});

// ===== MENÚ RÁPIDO DE CUADERNOS DESDE DETALLE =====
function openQuickListMenuFromDetail(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('quickListDropdown');
    if (!dropdown || !currentDetailMovie) return;

    const rect = e.currentTarget.getBoundingClientRect();
    dropdown.style.top = `${Math.max(10, rect.top - 180)}px`;
    dropdown.style.left = `${Math.max(10, Math.min(window.innerWidth - 220, rect.left))}px`;

    renderQuickListDropdownItems();
    dropdown.classList.remove('hidden');
}

function renderQuickListDropdownItems() {
    const container = document.getElementById('quickListItemsContainer');
    if (!container || !currentDetailMovie) return;

    container.innerHTML = '';

    if (customLists.length === 0) {
        container.innerHTML = `
            <div class="p-2 space-y-2 text-xs font-serif">
                <p class="text-stone-400 italic">No hay cuadernos creados.</p>
                <div class="flex gap-1">
                    <input type="text" id="quickNewListInput" placeholder="Nombre de libreta..." class="w-full bg-stone-100 dark:bg-stone-950 journal-border px-2 py-1 text-xs focus:outline-none focus:border-rose-800" onkeydown="if(event.key==='Enter') createNewListOnlyFromDetail()">
                    <button onclick="createNewListOnlyFromDetail()" class="bg-rose-900 text-white px-2 py-1 journal-border text-xs"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        `;
    } else {
        customLists.forEach((list) => {
            if (!list.movies) list.movies = [];
            const alreadyInList = list.movies.some(m => m.id === currentDetailMovie.id);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `w-full text-left px-2.5 py-2 hover:bg-stone-200 dark:hover:bg-stone-800 transition flex items-center justify-between text-xs font-serif cursor-pointer`;

            btn.innerHTML = `
                <span class="truncate">📓 ${_pmEsc(list.name)}</span>
                <span class="text-[10px] font-mono ${alreadyInList ? 'text-rose-800 dark:text-rose-400 font-bold' : 'text-stone-400'}">${alreadyInList ? '✓ Guardada' : '+ Añadir'}</span>
            `;

            btn.onclick = () => {
                if (alreadyInList) {
                    list.movies = list.movies.filter(m => m.id !== currentDetailMovie.id);
                } else {
                    list.movies.push(slimMovie(currentDetailMovie));
                }
                saveAndRenderCustomLists();
                renderQuickListDropdownItems();
            };
            container.appendChild(btn);
        });

        const newDiv = document.createElement('div');
        newDiv.className = "pt-2 border-t border-stone-200 dark:border-stone-800 mt-1 p-1 space-y-1";
        newDiv.innerHTML = `
            <div class="flex gap-1">
                <input type="text" id="quickNewListInput" placeholder="Nuevo cuaderno..." class="w-full bg-stone-100 dark:bg-stone-950 journal-border px-2 py-1 text-xs focus:outline-none focus:border-rose-800" onkeydown="if(event.key==='Enter') createNewListOnlyFromDetail()">
                <button onclick="createNewListOnlyFromDetail()" class="bg-rose-900 text-white px-2 py-1 journal-border text-xs"><i class="fa-solid fa-plus"></i></button>
            </div>
        `;
        container.appendChild(newDiv);
    }
}

function createNewListOnlyFromDetail() {
    const input = document.getElementById('quickNewListInput');
    if (!input || !input.value.trim()) return;
    const name = input.value.trim();

    customLists.push({
        id: Date.now(),
        name: name,
        isPublic: true,
        movies: []
    });
    saveAndRenderCustomLists();
    updateProfileDrawerStats();
    renderQuickListDropdownItems();
}

function closeQuickListDropdown() {
    const dropdown = document.getElementById('quickListDropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('quickListDropdown');
    const btn = document.querySelector('button[onclick*="openQuickListMenuFromDetail"]');

    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
            dropdown.classList.add('hidden');
        }
    }
});

// ===== AUTENTICACIÓN, VERIFICACIÓN DE CORREO Y REGISTRO COMPLETO =====
let _verifyPollTimer = null;
let _resendCooldownTimer = null;

function _setVerifyFeedback(msg, isOk) {
    const box = document.getElementById('authVerifyMsg');
    if (!box) return;
    if (!msg) {
        box.classList.add('hidden');
        box.textContent = '';
        return;
    }
    box.className = isOk
        ? 'text-emerald-700 dark:text-emerald-400 text-xs font-mono text-center bg-emerald-900/10 p-2 journal-border'
        : 'text-rose-700 dark:text-rose-400 text-xs font-mono text-center bg-rose-900/10 p-2 journal-border';
    box.textContent = msg;
}

window.stopAuthVerifyWatcher = function () {
    if (_verifyPollTimer) {
        clearInterval(_verifyPollTimer);
        _verifyPollTimer = null;
    }
    window.removeEventListener('focus', _silentCheckEmailVerified);
};

async function _silentCheckEmailVerified() {
    const step3 = document.getElementById('authStep3');
    const modal = document.getElementById('authModal');
    if (!step3 || step3.classList.contains('hidden') || !modal || modal.classList.contains('hidden')) return;
    if (!window.fbRefreshUser) return;
    try {
        const u = await window.fbRefreshUser();
        if (u && u.emailVerified) {
            window.stopAuthVerifyWatcher();
            if (window.fbCompleteVerifiedSession) await window.fbCompleteVerifiedSession(u);
            showToast('¡Correo verificado con éxito! Bienvenido/a a CineZine ✓', 'ok');
        }
    } catch (e) { console.warn('Comprobación automática de verificación:', e); }
}

window.showAuthLoginStep = function () {
    window.stopAuthVerifyWatcher();
    const s1 = document.getElementById('authStep1');
    const s2 = document.getElementById('authStep2');
    const s3 = document.getElementById('authStep3');
    if (s1) s1.classList.remove('hidden');
    if (s2) s2.classList.add('hidden');
    if (s3) s3.classList.add('hidden');
};

window.showAuthVerifyStep = function (email, msg, isOk) {
    const modal = document.getElementById('authModal');
    const s1 = document.getElementById('authStep1');
    const s2 = document.getElementById('authStep2');
    const s3 = document.getElementById('authStep3');
    const targetEmail = document.getElementById('verifyTargetEmail');

    if (s1) s1.classList.add('hidden');
    if (s2) s2.classList.add('hidden');
    if (s3) s3.classList.remove('hidden');
    if (targetEmail) targetEmail.textContent = email || (window.currentUser && window.currentUser.email) || 'tu correo';
    _setVerifyFeedback(msg || '', !!isOk);

    if (modal) modal.classList.remove('hidden');

    window.stopAuthVerifyWatcher();
    window.addEventListener('focus', _silentCheckEmailVerified);
    _verifyPollTimer = setInterval(() => {
        if (!document.hidden) _silentCheckEmailVerified();
    }, 5000);
};

document.addEventListener('DOMContentLoaded', () => {
    const authModal = document.getElementById('authModal');
    const step1 = document.getElementById('authStep1');
    const step2 = document.getElementById('authStep2');
    const step3 = document.getElementById('authStep3');
    const btnShowRegisterStep = document.getElementById('btnShowRegisterStep');
    const btnBackToStep1 = document.getElementById('btnBackToStep1');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerProfileForm');
    const rememberCheckbox = document.getElementById('rememberMe');
    const regPasswordInput = document.getElementById('regPassword');
    const btnFinalRegister = document.getElementById('btnFinalRegister');
    const regAvatarSeedInput = document.getElementById('regAvatarSeed');
    const regAvatarPreview = document.getElementById('regAvatarPreview');
    const btnCheckVerified = document.getElementById('btnCheckVerified');
    const btnResendVerify = document.getElementById('btnResendVerify');
    const btnBackFromVerify = document.getElementById('btnBackFromVerify');
    const btnGuestFromVerify = document.getElementById('btnGuestFromVerify');

    function startResendCooldown(seconds = 60) {
        if (!btnResendVerify) return;
        clearInterval(_resendCooldownTimer);
        let left = seconds;
        btnResendVerify.disabled = true;
        btnResendVerify.innerHTML = `<i class="fa-solid fa-clock mr-1.5"></i>Reenviar disponible en ${left}s`;
        _resendCooldownTimer = setInterval(() => {
            left--;
            if (left <= 0) {
                clearInterval(_resendCooldownTimer);
                btnResendVerify.disabled = false;
                btnResendVerify.innerHTML = `<i class="fa-solid fa-paper-plane mr-1.5"></i>Reenviar enlace de verificación`;
            } else {
                btnResendVerify.innerHTML = `<i class="fa-solid fa-clock mr-1.5"></i>Reenviar disponible en ${left}s`;
            }
        }, 1000);
    }

    if (btnCheckVerified) {
        btnCheckVerified.addEventListener('click', async () => {
            btnCheckVerified.disabled = true;
            const prevHtml = btnCheckVerified.innerHTML;
            btnCheckVerified.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Comprobando verificación...`;
            _setVerifyFeedback('', false);
            try {
                const u = window.fbRefreshUser ? await window.fbRefreshUser() : null;
                if (u && u.emailVerified) {
                    window.stopAuthVerifyWatcher();
                    if (window.fbCompleteVerifiedSession) await window.fbCompleteVerifiedSession(u);
                    showToast('¡Correo verificado! Bienvenido/a a CineZine ✓', 'ok');
                } else {
                    _setVerifyFeedback('Todavía no figura como verificado. Abre el enlace del correo (revisa Spam) y vuelve a pulsar aquí.', false);
                }
            } catch (err) {
                _setVerifyFeedback('No pudimos comprobar el estado ahora mismo. Inténtalo de nuevo en unos segundos.', false);
            } finally {
                btnCheckVerified.disabled = false;
                btnCheckVerified.innerHTML = prevHtml;
            }
        });
    }

    if (btnResendVerify) {
        btnResendVerify.addEventListener('click', async () => {
            _setVerifyFeedback('', false);
            try {
                if (window.fbResendVerification) await window.fbResendVerification();
                _setVerifyFeedback('¡Listo! Enviamos un nuevo enlace a tu correo. Revisa tu bandeja de entrada y Spam.', true);
                startResendCooldown(60);
            } catch (err) {
                const msg = err && err.code === 'auth/too-many-requests'
                    ? 'Ya se envió un correo recientemente. Espera un minuto antes de pedir otro.'
                    : 'No se pudo reenviar el correo. Inténtalo más tarde.';
                _setVerifyFeedback(msg, false);
            }
        });
    }

    if (btnBackFromVerify) {
        btnBackFromVerify.addEventListener('click', async () => {
            window.stopAuthVerifyWatcher();
            try { if (window.fbSignOutQuiet) await window.fbSignOutQuiet(); } catch (e) { console.warn('Error al cerrar sesión temporal:', e); }
            window.showAuthLoginStep();
        });
    }

    if (btnGuestFromVerify) {
        btnGuestFromVerify.addEventListener('click', async () => {
            window.stopAuthVerifyWatcher();
            sessionStorage.setItem('cineGuestChosen', '1');
            sessionStorage.setItem('guestMode', 'true');
            try { if (window.fbSignOutQuiet) await window.fbSignOutQuiet(); } catch (e) { console.warn('Error al cerrar sesión temporal:', e); }
            if (authModal) authModal.classList.add('hidden');
            currentUsername = 'Invitado/a'; window.currentUsername = 'Invitado/a';
            currentAvatarSeed = 'Invitado/a'; window.currentAvatarSeed = 'Invitado/a';
            updateProfileDrawerStats();
            renderMuralFeed();
        });
    }

    if (regAvatarSeedInput && regAvatarPreview) {
        regAvatarSeedInput.addEventListener('input', (e) => {
            const seedVal = e.target.value.trim() || 'default';
            regAvatarPreview.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seedVal)}`;
        });
    }

    if (regPasswordInput) {
        regPasswordInput.addEventListener('input', (e) => {
            const val = e.target.value;

            const hasLength = val.length >= 8;
            const hasUpper = /[A-Z]/.test(val);
            const hasLower = /[a-z]/.test(val);
            const hasNumber = /[0-9]/.test(val);
            const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(val);

            updateReqStyle('req-length', hasLength);
            updateReqStyle('req-upper', hasUpper);
            updateReqStyle('req-lower', hasLower);
            updateReqStyle('req-number', hasNumber);
            updateReqStyle('req-special', hasSpecial);

            if (hasLength && hasUpper && hasLower && hasNumber && hasSpecial) {
                btnFinalRegister.disabled = false;
                btnFinalRegister.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                btnFinalRegister.disabled = true;
                btnFinalRegister.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });
    }

    function updateReqStyle(elementId, isValid) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (isValid) {
            el.className = "text-emerald-400 flex items-center gap-1.5 transition-colors";
            el.innerHTML = el.innerHTML.replace('❌', '✔');
        } else {
            el.className = "text-stone-500 flex items-center gap-1.5 transition-colors";
            el.innerHTML = el.innerHTML.replace('✔', '❌');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            const errorDiv = document.getElementById('authErrorMsg');

            if (errorDiv) { errorDiv.classList.add('hidden'); errorDiv.innerText = ''; }

            try {
                await window.setAuthPersistence(rememberCheckbox.checked);
                const cred = await window.fbSignIn(email, password);
                const u = window.fbRefreshUser ? await window.fbRefreshUser() : (cred && cred.user);

                if (u && _isUserUnverified(u)) {
                    window.showAuthVerifyStep(u.email || email, 'Tu correo aún no ha sido verificado. Confirma el enlace en tu bandeja o pide uno nuevo.', false);
                    return;
                }

                sessionStorage.removeItem('guestMode');
                updateProfileDrawerStats();
                if (authModal) authModal.classList.add('hidden');
            } catch (err) {
                let friendlyMessage = "Correo electrónico o contraseña incorrectos.";
                if (err.code === 'auth/too-many-requests') {
                    friendlyMessage = "Demasiados intentos fallidos. Inténtalo más tarde.";
                } else if (err.code === 'auth/user-disabled') {
                    friendlyMessage = "Esta cuenta ha sido deshabilitada.";
                } else if (err.code === 'auth/invalid-email') {
                    friendlyMessage = "El formato del correo electrónico no es válido.";
                }

                if (errorDiv) {
                    errorDiv.innerText = friendlyMessage;
                    errorDiv.classList.remove('hidden');
                }
            }
        });
    }

    if (btnShowRegisterStep) {
        btnShowRegisterStep.addEventListener('click', () => {
            if (step1) step1.classList.add('hidden');
            if (step3) step3.classList.add('hidden');
            if (step2) step2.classList.remove('hidden');
        });
    }

    if (btnBackToStep1) {
        btnBackToStep1.addEventListener('click', () => {
            if (step2) step2.classList.add('hidden');
            if (step3) step3.classList.add('hidden');
            if (step1) step1.classList.remove('hidden');
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const usernameVal = document.getElementById('regUsername').value.trim();
            const avatarSeedVal = document.getElementById('regAvatarSeed') ? document.getElementById('regAvatarSeed').value.trim() : '';
            const bioVal = document.getElementById('regUserBio') ? document.getElementById('regUserBio').value.trim() : '';
            const errorDiv = document.getElementById('authRegisterErrorMsg');

            if (errorDiv) { errorDiv.classList.add('hidden'); errorDiv.innerText = ''; }
            if (btnFinalRegister) btnFinalRegister.disabled = true;

            try {
                window._signingUp = true;
                await window.setAuthPersistence(rememberCheckbox.checked);
                const cred = await window.fbSignUp(email, password);

                const username = usernameVal || 'Cinéfilo/a';
                const avatarSeed = avatarSeedVal || username;
                const bio = bioVal || currentUserBio;

                currentUsername = username;      window.currentUsername = username;
                currentAvatarSeed = avatarSeed;  window.currentAvatarSeed = avatarSeed;
                currentUserBio = bio;            window.currentUserBio = bio;
                localStorage.setItem('cine_username', username);
                localStorage.setItem('cine_avatar_seed', avatarSeed);
                localStorage.setItem('cine_user_bio', bio);

                await window.fbSaveProfile({ username, avatarSeed, bio });

                let mailSent = false;
                try {
                    await window.fbResendVerification();
                    mailSent = true;
                } catch (e) { console.warn('No se pudo enviar la verificación:', e); }

                if (cred && cred.user && _isUserUnverified(cred.user)) {
                    window.showAuthVerifyStep(
                        email,
                        mailSent ? '¡Cuenta creada! Revisa tu bandeja de entrada para confirmar tu correo.' : 'Cuenta creada. Pulsa "Reenviar enlace" para recibir tu correo de activación.',
                        mailSent
                    );
                    if (mailSent) startResendCooldown(60);
                    updateProfileDrawerStats();
                    return;
                }

                sessionStorage.removeItem('guestMode');
                await window.fbInitLibrary();
                updateProfileDrawerStats();
                if (authModal) authModal.classList.add('hidden');
            } catch (err) {
                let friendlyMessage = "Error al crear la cuenta. Inténtalo de nuevo.";
                if (err.code === 'auth/email-already-in-use') {
                    friendlyMessage = "Este correo electrónico ya está registrado.";
                } else if (err.code === 'auth/weak-password') {
                    friendlyMessage = "La contraseña es muy débil.";
                } else if (err.code === 'auth/invalid-email') {
                    friendlyMessage = "El formato del correo electrónico no es válido.";
                }

                if (errorDiv) {
                    errorDiv.innerText = friendlyMessage;
                    errorDiv.classList.remove('hidden');
                }
            } finally {
                window._signingUp = false;
                if (btnFinalRegister && regPasswordInput) {
                    regPasswordInput.dispatchEvent(new Event('input'));
                }
            }
        });
    }

    const btnGoogle = document.getElementById('btnGoogleAuth');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            try {
                await window.setAuthPersistence(rememberCheckbox.checked);
                await window.fbLoginGoogle();
                sessionStorage.removeItem('guestMode');
            } catch (err) {
                showToast("Error con Google: " + err.message, 'error');
            }
        });
    }

    const btnGuest = document.getElementById('btnGuestAuth');
    if (btnGuest) {
        btnGuest.addEventListener('click', () => {
            [...CINE_SYNC_KEYS, 'cine_username', 'cine_avatar_seed', 'cine_user_bio', 'cine_avatar_custom_url', 'cine_data_owner']
                .forEach(k => localStorage.removeItem(k));
            sessionStorage.setItem('cineGuestChosen', '1');
            sessionStorage.setItem('guestMode', 'true');

            watchedMovies = [];
            watchedMoviesData = {};
            watchedEpisodes = {};
            personalReviews = {};
            customLists = [];
            currentUsername = 'Invitado/a';
            window.currentUsername = 'Invitado/a';

            if (authModal) authModal.classList.add('hidden');

            window.updateProfileUI(null);
            renderCustomLists();
            renderResultsGrid();
            renderMuralFeed();
        });
    }
});

// Función para actualizar la UI del panel de perfil y estado de sesión
window.updateProfileDrawerStats = function () {
    if (!window.currentUser && sessionStorage.getItem('guestMode') === 'true') {
        currentUsername = 'Invitado/a';
        currentAvatarSeed = 'Invitado/a';
    }

    const hUsername = document.getElementById('headerUsername');
    const dUsername = document.getElementById('drawerUsername');
    const dBioInput = document.getElementById('drawerUserBioInput');

    if (hUsername) hUsername.innerText = currentUsername;
    if (dUsername) dUsername.innerText = currentUsername;
    if (dBioInput) dBioInput.value = currentUserBio;

    const avatarUrl = getAvatarUrl();
    const hAvatar = document.getElementById('headerProfileAvatar');
    const dAvatar = document.getElementById('drawerProfileAvatar');

    if (hAvatar) hAvatar.src = avatarUrl;
    if (dAvatar) dAvatar.src = avatarUrl;

    prunePersonalReviews();
    const sWatched = document.getElementById('statWatchedCount');
    const sBitacora = document.getElementById('statBitacoraCount');
    const sLists = document.getElementById('statListsCount');
    if (sWatched) sWatched.innerText = watchedMovies.length;
    if (sBitacora) sBitacora.innerText = countValidPersonalReviews(personalReviews);
    if (sLists) sLists.innerText = customLists.length;

    let authSection = document.getElementById('drawerAuthSection');
    const drawerContent = document.getElementById('profileDrawer') ? document.getElementById('profileDrawer').querySelector('.space-y-4, .p-6, div') : null;

    if (!authSection && drawerContent) {
        authSection = document.createElement('div');
        authSection.id = 'drawerAuthSection';
        authSection.className = 'p-4 border-t border-stone-200 dark:border-stone-800 mt-2';
        drawerContent.appendChild(authSection);
    }

    if (authSection) {
        if (window.currentUser && _isUserUnverified(window.currentUser)) {
            authSection.innerHTML = `
                <div class="space-y-2">
                    <button onclick="toggleProfileDrawer(); window.showAuthVerifyStep(window.currentUser.email);" class="w-full py-2 bg-amber-700 hover:bg-amber-600 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider font-bold cursor-pointer">
                        <i class="fa-solid fa-envelope-circle-check mr-2"></i>Verificar correo pendiente
                    </button>
                    <button onclick="window.fbSignOut();" class="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider cursor-pointer">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i>Cerrar Sesión
                    </button>
                </div>
            `;
        } else if (window.currentUser) {
            authSection.innerHTML = `
                <div class="space-y-2">
                    <button onclick="window.fbSignOut();" class="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider cursor-pointer">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i>Cerrar Sesión
                    </button>
                    <button onclick="window.fbDeleteAccount()" class="w-full py-2 bg-rose-950 hover:bg-rose-900 text-rose-400 font-mono text-xs journal-border transition uppercase tracking-wider cursor-pointer">
                        <i class="fa-solid fa-trash-can mr-2"></i>Eliminar cuenta
                    </button>
                </div>
            `;
        } else {
            authSection.innerHTML = `
                <button onclick="toggleProfileDrawer(); window.showAuthLoginStep && window.showAuthLoginStep(); document.getElementById('authModal').classList.remove('hidden');" class="w-full py-2 bg-rose-900 hover:bg-rose-800 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider font-bold cursor-pointer">
                    <i class="fa-solid fa-right-to-bracket mr-2"></i>Iniciar Sesión / Registrarse
                </button>
            `;
        }
    }
    if (window.refreshOpenProfileModals) window.refreshOpenProfileModals();
};

window.updateProfileUI = function (user) {
    if (typeof window.updateProfileDrawerStats === 'function') {
        window.updateProfileDrawerStats();
    }
};
