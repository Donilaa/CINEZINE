const TMDB_BEARER_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjYjQwZTE1MTc4ZDYyNWY5N2Q5N2YxOWI1YTM5ZjE1NCIsIm5iZiI6MTc5MjEwMzE3Ni4wOTcsInN1YiI6IjZhZDE1MzA4MTg4NDAyOWU1ODE4ZTk3ZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.RUI9o-J4oFpIOCbXlLZ88KwBfN9WcWcf0bfOQUKq2dA";

let currentLang = "es-MX"; 
let currentTitleLang = "en-US"; 
let oscarMode = "WINNERS"; 
let moviesList = []; 
let fetchedResults = [];
let currentFilterPage = 1;
let totalFilterPages = 1;
let currentOscarList = [];
let watchedMovies = JSON.parse(localStorage.getItem('cine_watched_movies') || '[]');
let watchedMoviesData = JSON.parse(localStorage.getItem('cine_watched_movies_data') || '{}');
let personalReviews = JSON.parse(localStorage.getItem('cine_personal_reviews') || '{}');
let customLists = JSON.parse(localStorage.getItem('cine_custom_lists') || '[]');
let diarioMuralReviews = JSON.parse(localStorage.getItem('cine_diario_mural') || '[]');
let currentUsername = localStorage.getItem('cine_username') || 'Dante';

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
let fetchDebounceTimer = null;

const OSCAR_DATABASE = [
    { oscarYear: 2024, isWinner: true,  tmdbId: 872585, defaultTitle: "Oppenheimer" },
    { oscarYear: 2024, isWinner: false, tmdbId: 346698, defaultTitle: "Barbie" },
    { oscarYear: 2024, isWinner: false, tmdbId: 466420, defaultTitle: "Killers of the Flower Moon" },
    { oscarYear: 2024, isWinner: false, tmdbId: 792307, defaultTitle: "Poor Things" },
    { oscarYear: 2024, isWinner: false, tmdbId: 915935, defaultTitle: "Anatomy of a Fall" },
    { oscarYear: 2024, isWinner: false, tmdbId: 666277, defaultTitle: "Past Lives" },
    { oscarYear: 2023, isWinner: true,  tmdbId: 545611, defaultTitle: "Everything Everywhere All at Once" },
    { oscarYear: 2023, isWinner: false, tmdbId: 361743, defaultTitle: "Top Gun: Maverick" },
    { oscarYear: 2023, isWinner: false, tmdbId: 76600,  defaultTitle: "Avatar: The Way of Water" },
    { oscarYear: 2023, isWinner: false, tmdbId: 674324, defaultTitle: "The Banshees of Inisherin" },
    { oscarYear: 2022, isWinner: true,  tmdbId: 601498, defaultTitle: "CODA" },
    { oscarYear: 2022, isWinner: false, tmdbId: 438631, defaultTitle: "Dune" },
    { oscarYear: 2022, isWinner: false, tmdbId: 600583, defaultTitle: "The Power of the Dog" },
    { oscarYear: 2021, isWinner: true,  tmdbId: 581734, defaultTitle: "Nomadland" },
    { oscarYear: 2021, isWinner: false, tmdbId: 530915, defaultTitle: "1917" },
    { oscarYear: 2021, isWinner: false, tmdbId: 522162, defaultTitle: "Jojo Rabbit" },
    { oscarYear: 2020, isWinner: true,  tmdbId: 496243, defaultTitle: "Parasite" },
    { oscarYear: 2020, isWinner: false, tmdbId: 475557, defaultTitle: "Joker" },
    { oscarYear: 2020, isWinner: false, tmdbId: 398978, defaultTitle: "The Irishman" },
    { oscarYear: 2019, isWinner: true,  tmdbId: 490132, defaultTitle: "Green Book" },
    { oscarYear: 2019, isWinner: false, tmdbId: 424694, defaultTitle: "Bohemian Rhapsody" },
    { oscarYear: 2018, isWinner: true,  tmdbId: 399055, defaultTitle: "The Shape of Water" },
    { oscarYear: 2017, isWinner: true,  tmdbId: 376867, defaultTitle: "Moonlight" },
    { oscarYear: 2017, isWinner: false, tmdbId: 313369, defaultTitle: "La La Land" },
    { oscarYear: 2016, isWinner: true,  tmdbId: 299534, defaultTitle: "Spotlight" },
    { oscarYear: 2015, isWinner: true,  tmdbId: 225886, defaultTitle: "Birdman" },
    { oscarYear: 2014, isWinner: true,  tmdbId: 76203,  defaultTitle: "12 Years a Slave" },
    { oscarYear: 2013, isWinner: true,  tmdbId: 68734,  defaultTitle: "Argo" },
    { oscarYear: 2012, isWinner: true,  tmdbId: 74643,  defaultTitle: "The Artist" },
    { oscarYear: 2011, isWinner: true,  tmdbId: 45269,  defaultTitle: "The King's Speech" },
    { oscarYear: 2010, isWinner: true,  tmdbId: 12162,  defaultTitle: "The Hurt Locker" },
    { oscarYear: 2009, isWinner: true,  tmdbId: 44214,  defaultTitle: "Slumdog Millionaire" },
    { oscarYear: 2008, isWinner: true,  tmdbId: 6977,   defaultTitle: "No Country for Old Men" },
    { oscarYear: 2007, isWinner: true,  tmdbId: 1422,   defaultTitle: "The Departed" },
    { oscarYear: 2006, isWinner: true,  tmdbId: 1669,   defaultTitle: "Crash" },
    { oscarYear: 2005, isWinner: true,  tmdbId: 70,     defaultTitle: "Million Dollar Baby" },
    { oscarYear: 2004, isWinner: true,  tmdbId: 122,    defaultTitle: "The Lord of the Rings: The Return of the King" },
    { oscarYear: 2003, isWinner: true,  tmdbId: 1911,   defaultTitle: "Chicago" },
    { oscarYear: 2002, isWinner: true,  tmdbId: 475,    defaultTitle: "A Beautiful Mind" },
    { oscarYear: 2001, isWinner: true,  tmdbId: 98,     defaultTitle: "Gladiator" },
    { oscarYear: 2000, isWinner: true,  tmdbId: 14,     defaultTitle: "American Beauty" }
];

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
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
        const pointer = document.getElementById('roulettePointer');
        pointer.style.transform = 'translateY(-4px)';
        setTimeout(() => pointer.style.transform = 'translateY(0)', 50);
    } catch (e) {}
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
    } catch (e) {}
}

function toggleTheme() {
    const html = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('cine_theme', 'light');
        themeIcon.className = "fa-solid fa-sun text-xs text-amber-600";
    } else {
        html.classList.add('dark');
        localStorage.setItem('cine_theme', 'dark');
        themeIcon.className = "fa-solid fa-moon text-xs text-amber-400";
    }
    drawWheel();
}

if (localStorage.getItem('cine_theme') === 'light') {
    document.documentElement.classList.remove('dark');
    document.getElementById('themeIcon').className = "fa-solid fa-sun text-xs text-amber-600";
}

function toggleMute() {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('muteIcon');
    const text = document.getElementById('muteText');
    if (soundEnabled) {
        icon.className = "fa-solid fa-volume-high text-rose-800 dark:text-rose-500";
        text.innerText = "Sonido On";
    } else {
        icon.className = "fa-solid fa-volume-xmark text-stone-400";
        text.innerText = "Muteado";
    }
}

function toggleSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const uInput = document.getElementById('usernameInput');
    if (uInput) uInput.value = currentUsername;
    modal.classList.toggle('hidden');
}

function updateUsername(val) {
    if (val.trim()) {
        currentUsername = val.trim();
        localStorage.setItem('cine_username', currentUsername);
    }
}

function changeLanguage(newLang) {
    currentLang = newLang;
    resetAndFetchFilteredMovies();
    loadOscarMovies();
}

function changeTitleLanguage(newTitleLang) {
    currentTitleLang = newTitleLang;
    resetAndFetchFilteredMovies();
    loadOscarMovies();
}

function switchRightTab(tabName) {
    const btnBitacora = document.getElementById('tabBitacoraBtn');
    const btnMural = document.getElementById('tabMuralBtn');
    const btnVistas = document.getElementById('tabVistasBtn');
    
    const contentBitacora = document.getElementById('tabBitacoraContent');
    const contentMural = document.getElementById('tabMuralContent');
    const contentVistas = document.getElementById('tabVistasContent');

    const activeClass = "flex-1 text-center font-heading font-bold uppercase tracking-wider text-rose-800 dark:text-rose-500 border-b-2 border-rose-800 pb-1";
    const inactiveClass = "flex-1 text-center font-heading font-bold uppercase tracking-wider text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 pb-1";

    btnBitacora.className = tabName === 'bitacora' ? activeClass : inactiveClass;
    btnMural.className = tabName === 'mural' ? activeClass : inactiveClass;
    btnVistas.className = tabName === 'vistas' ? activeClass : inactiveClass;

    contentBitacora.classList.toggle('hidden', tabName !== 'bitacora');
    contentMural.classList.toggle('hidden', tabName !== 'mural');
    contentVistas.classList.toggle('hidden', tabName !== 'vistas');
}

function handleRangeInput() {
    let minVal = parseFloat(document.getElementById('minRatingInput').value);
    let maxVal = parseFloat(document.getElementById('maxRatingInput').value);
    if (minVal > maxVal) {
        let temp = minVal; minVal = maxVal; maxVal = temp;
        document.getElementById('minRatingInput').value = minVal;
        document.getElementById('maxRatingInput').value = maxVal;
    }
    document.getElementById('minRatingVal').innerText = minVal.toFixed(1);
    document.getElementById('maxRatingVal').innerText = maxVal.toFixed(1);
}

function debounceFetchFilteredMovies() {
    clearTimeout(fetchDebounceTimer);
    fetchDebounceTimer = setTimeout(() => { resetAndFetchFilteredMovies(); }, 400);
}

function toggleWatchedStatus(movieOrId, event) {
    if (event) event.stopPropagation();
    let movieId = typeof movieOrId === 'object' ? movieOrId.id : movieOrId;
    const index = watchedMovies.indexOf(movieId);
    
    if (index > -1) {
        watchedMovies.splice(index, 1);
        delete watchedMoviesData[movieId];
    } else {
        watchedMovies.push(movieId);
        if (typeof movieOrId === 'object') watchedMoviesData[movieId] = movieOrId;
        else if (currentDetailMovie && currentDetailMovie.id === movieId) watchedMoviesData[movieId] = currentDetailMovie;
    }

    localStorage.setItem('cine_watched_movies', JSON.stringify(watchedMovies));
    localStorage.setItem('cine_watched_movies_data', JSON.stringify(watchedMoviesData));
    
    renderResultsGrid();
    renderOscarList();
    renderCustomLists();
    renderPersonalBitacora();
    renderWatchedMoviesTab();
    
    if (currentDetailMovie && currentDetailMovie.id === movieId) updateDetailModalWatchedButton(movieId);
}

function updateDetailModalWatchedButton(movieId) {
    const isWatched = watchedMovies.includes(movieId);
    const btn = document.getElementById('detailWatchedBtn');
    const icon = document.getElementById('detailWatchedIcon');
    if (isWatched) {
        btn.className = "absolute top-2 right-2 bg-emerald-700/20 text-emerald-700 dark:text-emerald-400 journal-border p-1.5 text-xs transition shadow-md";
        icon.className = "fa-solid fa-check";
    } else {
        btn.className = "absolute top-2 right-2 bg-stone-50 dark:bg-stone-900 text-stone-500 hover:text-stone-900 dark:hover:text-white journal-border p-1.5 text-xs transition shadow-md";
        icon.className = "fa-solid fa-eye-slash";
    }
    btn.onclick = (e) => toggleWatchedStatus(currentDetailMovie || movieId, e);
}

function openQuickListMenu(movie, event) {
    if (event) event.stopPropagation();
    currentDetailMenuMovie = typeof movie === 'string' ? JSON.parse(movie) : movie;
    const dropdown = document.getElementById('quickListDropdown');
    const container = document.getElementById('quickListItemsContainer');
    container.innerHTML = '';

    if (customLists.length === 0) {
        container.innerHTML = `<div class="text-[10px] font-serif text-stone-400 italic p-2 text-center">No hay cuadernos creados.</div>`;
    } else {
        customLists.forEach(list => {
            const alreadyIn = list.movies.some(m => m.id === currentDetailMenuMovie.id);
            const item = document.createElement('button');
            item.className = `w-full text-left px-2.5 py-1.5 rounded-none text-xs flex items-center justify-between transition font-serif ${alreadyIn ? 'text-rose-900 dark:text-rose-400 bg-stone-200 dark:bg-stone-800' : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'}`;
            item.innerHTML = `<span class="truncate">${list.name}</span> ${alreadyIn ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}`;
            item.onclick = (e) => {
                e.stopPropagation();
                if (!alreadyIn) addMovieToCustomList(list.id, currentDetailMenuMovie);
                dropdown.classList.add('hidden');
            };
            container.appendChild(item);
        });
    }

    const targetBtn = event ? event.currentTarget : document.body;
    const rect = targetBtn.getBoundingClientRect();
    dropdown.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 200)}px`;
    dropdown.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 220))}px`;
    dropdown.classList.remove('hidden');
}

function closeQuickListDropdown() { document.getElementById('quickListDropdown').classList.add('hidden'); }
function openQuickListMenuFromDetail(event) { if (currentDetailMovie) openQuickListMenu(currentDetailMovie, event); }

window.addEventListener('click', (event) => {
    const dropdown = document.getElementById('quickListDropdown');
    if (dropdown && !dropdown.contains(event.target) && !event.target.closest('button[onclick*="openQuickListMenu"]')) {
        dropdown.classList.add('hidden');
    }
});

function renderStarSelector(val) {
    selectedStarRating = val || 0;
    const container = document.getElementById('starContainer');
    container.innerHTML = '';
    document.getElementById('starRatingText').innerText = selectedStarRating.toFixed(1);
    for (let i = 1; i <= 10; i++) {
        const starWrapper = document.createElement('div');
        starWrapper.className = "relative cursor-pointer text-sm px-0.5 text-stone-300 dark:text-stone-700";
        const isFull = selectedStarRating >= i;
        const isHalf = selectedStarRating === i - 0.5;
        let iconClass = "fa-regular fa-star text-stone-300 dark:text-stone-700";
        if (isFull) iconClass = "fa-solid fa-star text-amber-600";
        else if (isHalf) iconClass = "fa-solid fa-star-half-stroke text-amber-600";
        starWrapper.innerHTML = `<i class="${iconClass}"></i>`;
        starWrapper.onclick = (e) => {
            const rect = starWrapper.getBoundingClientRect();
            if ((e.clientX - rect.left) < rect.width / 2) selectedStarRating = i - 0.5;
            else selectedStarRating = i;
            renderStarSelector(selectedStarRating);
        };
        container.appendChild(starWrapper);
    }
}

function clearPersonalRating() { selectedStarRating = 0; renderStarSelector(0); }

function savePersonalReview() {
    if (!currentDetailMovie) return;
    const reviewInput = document.getElementById('userPersonalReview').value.trim();
    const isPublic = document.getElementById('userPublicReviewCheck').checked;

    personalReviews[currentDetailMovie.id] = {
        movie: currentDetailMovie,
        rating: selectedStarRating > 0 ? selectedStarRating : null,
        review: reviewInput,
        isPublic: isPublic
    };
    localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));

    if (isPublic && reviewInput) {
        diarioMuralReviews = diarioMuralReviews.filter(r => !(r.movieId === currentDetailMovie.id && r.author === currentUsername));
        diarioMuralReviews.unshift({
            id: 'rev_' + Date.now(),
            movieId: currentDetailMovie.id,
            movie: currentDetailMovie,
            author: currentUsername,
            rating: selectedStarRating > 0 ? selectedStarRating : null,
            review: reviewInput,
            date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        });
        localStorage.setItem('cine_diario_mural', JSON.stringify(diarioMuralReviews));
    } else if (!isPublic) {
        diarioMuralReviews = diarioMuralReviews.filter(r => !(r.movieId === currentDetailMovie.id && r.author === currentUsername));
        localStorage.setItem('cine_diario_mural', JSON.stringify(diarioMuralReviews));
    }

    renderResultsGrid();
    renderPersonalBitacora();
    renderDiarioMuralTab();
    renderDetailPublicReviews();

    const indicator = document.getElementById('saveStatusIndicator');
    if (indicator) {
        indicator.classList.remove('hidden');
        setTimeout(() => indicator.classList.add('hidden'), 2500);
    }
}

function renderPersonalBitacora() {
    const container = document.getElementById('personalReviewsContainer');
    if (!container) return;
    container.innerHTML = '';
    const keys = Object.keys(personalReviews);
    if (keys.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-stone-400 text-xs font-serif italic">Sin apuntes en bitácora.</div>`;
        return;
    }
    keys.forEach(id => {
        const item = personalReviews[id];
        const movie = item.movie;
        if (!movie) return;
        const card = document.createElement('div');
        card.className = "bg-stone-100 dark:bg-stone-950 journal-border p-2 space-y-1 cursor-pointer hover:border-rose-800 transition";
        card.onclick = () => openDetailModal(movie, "Bitácora Crítica");
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <h5 class="text-xs font-serif font-bold truncate max-w-[140px] text-rose-900 dark:text-rose-400">${movie.title}</h5>
                <div class="text-[10px] font-mono text-amber-600 font-bold flex items-center space-x-1"><i class="fa-solid fa-star"></i><span>${item.rating ? item.rating.toFixed(1) : 'Sin nota'}</span></div>
            </div>
            ${item.review ? `<p class="text-[11px] font-serif text-stone-600 dark:text-stone-300 italic line-clamp-2 bg-stone-50 dark:bg-stone-900 p-1.5 journal-border">"${item.review}"</p>` : ''}
        `;
        container.appendChild(card);
    });
}

function renderDiarioMuralTab() {
    const container = document.getElementById('diarioMuralContainer');
    if (!container) return;
    container.innerHTML = '';

    if (diarioMuralReviews.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-stone-400 text-xs font-serif italic">Aún no hay publicaciones en el Diario Mural.</div>`;
        return;
    }

    diarioMuralReviews.forEach(item => {
        const movie = item.movie;
        if (!movie) return;
        const card = document.createElement('div');
        card.className = "bg-stone-100 dark:bg-stone-950 journal-border p-2 space-y-1.5 cursor-pointer hover:border-amber-600 transition";
        card.onclick = () => openDetailModal(movie, "Publicado en Diario Mural");
        card.innerHTML = `
            <div class="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-1 text-[10px] font-mono">
                <span class="text-rose-900 dark:text-rose-400 font-bold"><i class="fa-solid fa-user-pen mr-1"></i>${item.author}</span>
                <span class="text-stone-400">${item.date || ''}</span>
            </div>
            <div class="flex items-center justify-between">
                <h5 class="text-xs font-serif font-bold truncate max-w-[130px] text-stone-800 dark:text-stone-200">${movie.title}</h5>
                <div class="text-[10px] font-mono text-amber-600 font-bold flex items-center space-x-1"><i class="fa-solid fa-star"></i><span>${item.rating ? item.rating.toFixed(1) : 'N/A'}</span></div>
            </div>
            <p class="text-[11px] font-serif text-stone-700 dark:text-stone-300 italic line-clamp-3 bg-stone-50 dark:bg-stone-900 p-1.5 journal-border">"${item.review}"</p>
        `;
        container.appendChild(card);
    });
}

function renderDetailPublicReviews() {
    const container = document.getElementById('detailPublicReviewsContainer');
    if (!container || !currentDetailMovie) return;
    container.innerHTML = '';

    const matching = diarioMuralReviews.filter(r => r.movieId === currentDetailMovie.id);

    if (matching.length === 0) {
        container.innerHTML = `<div class="text-[11px] font-serif text-stone-400 italic">No hay notas públicas para esta obra aún.</div>`;
        return;
    }

    matching.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-stone-100 dark:bg-stone-950 journal-border p-2 space-y-1";
        card.innerHTML = `
            <div class="flex items-center justify-between text-[10px] font-mono">
                <span class="font-bold text-rose-900 dark:text-rose-400"><i class="fa-solid fa-user mr-1"></i>${item.author}</span>
                <span class="text-amber-600 font-bold"><i class="fa-solid fa-star mr-0.5"></i>${item.rating ? item.rating.toFixed(1) : 'N/A'}</span>
            </div>
            <p class="text-[11px] font-serif text-stone-700 dark:text-stone-300 italic">"${item.review}"</p>
        `;
        container.appendChild(card);
    });
}

function renderWatchedMoviesTab() {
    const container = document.getElementById('watchedMoviesListContainer');
    const countHeader = document.getElementById('watchedCountHeader');
    if (!container) return;
    container.innerHTML = '';
    countHeader.innerText = watchedMovies.length;
    if (watchedMovies.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-stone-400 text-xs font-serif italic">No has marcado películas vistas.</div>`;
        return;
    }
    watchedMovies.forEach(id => {
        const movie = watchedMoviesData[id];
        const card = document.createElement('div');
        card.className = "bg-stone-100 dark:bg-stone-950 journal-border p-2 flex items-center justify-between text-xs font-serif cursor-pointer hover:border-rose-800 transition";
        card.onclick = (e) => { if (!e.target.closest('button') && movie) openDetailModal(movie, "Película Vista"); };
        card.innerHTML = `
            <span class="truncate max-w-[140px] text-stone-800 dark:text-stone-200">${movie ? movie.title : `Obra #${id}`}</span>
            <button onclick='toggleWatchedStatus(${id}, event)' title="Quitar de vistas" class="text-emerald-600 hover:text-rose-800 text-xs px-1"><i class="fa-solid fa-check"></i></button>
        `;
        container.appendChild(card);
    });
}

function createNewList() {
    const input = document.getElementById('newListInput');
    const name = input.value.trim();
    if (!name) return;
    if (customLists.some(l => l.name.toLowerCase() === name.toLowerCase())) { return; }
    customLists.push({ id: Date.now(), name: name, movies: [] });
    saveAndRenderCustomLists();
    input.value = '';
}

function promptDeleteCustomList(listId) {
    pendingListDeleteId = listId;
    const list = customLists.find(l => l.id === listId);
    document.getElementById('confirmModalText').innerText = `Estás a punto de descartar el cuaderno "${list ? list.name : ''}".`;
    document.getElementById('confirmDeleteBtn').onclick = executeDeleteCustomList;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() { document.getElementById('confirmModal').classList.add('hidden'); pendingListDeleteId = null; }
function executeDeleteCustomList() {
    if (pendingListDeleteId !== null) {
        customLists = customLists.filter(l => l.id !== pendingListDeleteId);
        saveAndRenderCustomLists();
        closeConfirmModal();
    }
}

function addMovieToCustomList(listId, movie) {
    const list = customLists.find(l => l.id === listId);
    if (list && !list.movies.some(m => m.id === movie.id)) { list.movies.push(movie); saveAndRenderCustomLists(); }
}

function removeMovieFromCustomList(listId, movieId) {
    const list = customLists.find(l => l.id === listId);
    if (list) { list.movies = list.movies.filter(m => m.id !== movieId); saveAndRenderCustomLists(); }
}

function loadListToRoulette(listId) {
    const list = customLists.find(l => l.id === listId);
    if (list && list.movies.length > 0) {
        list.movies.forEach(m => { if (!watchedMovies.includes(m.id) && !moviesList.some(e => e.id === m.id)) moviesList.push(m); });
        updateUI();
    }
}

function saveAndRenderCustomLists() { localStorage.setItem('cine_custom_lists', JSON.stringify(customLists)); renderCustomLists(); }

function renderCustomLists() {
    const container = document.getElementById('customListsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (customLists.length === 0) { 
        container.innerHTML = `<div class="text-center py-6 text-stone-400 text-xs font-serif italic">Sin cuadernos creados.</div>`; 
        return; 
    }
    
    customLists.forEach(list => {
        const item = document.createElement('div');
        item.className = "bg-stone-100 dark:bg-stone-950 journal-border p-2.5 space-y-2";
        let moviesHtml = '';
        
        if (list.movies.length === 0) {
            moviesHtml = `<div class="text-[10px] font-serif text-stone-400 italic">Libreta vacía.</div>`;
        } else {
            list.movies.forEach((m, idx) => {
                const isWatched = watchedMovies.includes(m.id);
                moviesHtml += `
                    <div draggable="true" 
                         ondragstart="handleDragStart(event, ${list.id}, ${idx})" 
                         ondragover="handleDragOver(event)" 
                         ondrop="handleDrop(event, ${list.id}, ${idx})" 
                         onclick='openDetailModal(${JSON.stringify(m).replace(/'/g, "&apos;")}, "Cuaderno: ${list.name}")' 
                         class="flex items-center justify-between bg-stone-50 dark:bg-stone-900 px-2 py-1 journal-border text-xs font-serif text-stone-700 dark:text-stone-300 cursor-grab active:cursor-grabbing hover:border-rose-800 transition select-none">
                        
                        <div class="flex items-center space-x-1.5 truncate max-w-[120px]">
                            <i class="fa-solid fa-grip-vertical text-stone-400 text-[10px]"></i>
                            <span class="truncate ${isWatched ? 'line-through opacity-50' : ''}">${m.title}</span>
                        </div>
                        
                        <div class="flex items-center space-x-1.5 flex-shrink-0">
                            <button onclick='toggleWatchedStatus(${JSON.stringify(m).replace(/'/g, "&apos;")}, event)' title="Marcar vista" class="text-[10px] ${isWatched ? 'text-emerald-600 font-bold' : 'text-stone-400 hover:text-stone-900 dark:hover:text-white'}">
                                <i class="fa-solid ${isWatched ? 'fa-check' : 'fa-eye-slash'}"></i>
                            </button>
                            <button onclick="event.stopPropagation(); removeMovieFromCustomList(${list.id}, ${m.id})" title="Quitar" class="text-[10px] text-stone-400 hover:text-rose-800">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        item.innerHTML = `
            <div class="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-1.5">
                <h4 class="text-xs font-heading font-bold text-rose-900 dark:text-rose-400 truncate max-w-[110px]">${list.name} (${list.movies.length})</h4>
                <div class="flex items-center space-x-1">
                    <button onclick="loadListToRoulette(${list.id})" title="Cargar a sorteo" class="text-[10px] font-mono bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 px-2 py-0.5 journal-border transition"><i class="fa-solid fa-rotate"></i> Sorteo</button>
                    <button onclick="promptDeleteCustomList(${list.id})" title="Descartar" class="text-stone-400 hover:text-rose-800 text-xs px-1 transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">${moviesHtml}</div>
        `;
        container.appendChild(item);
    });
}

const colorsDark = ["#50101d", "#1e293b", "#78350f", "#334155", "#4c0519", "#0f172a", "#713f12", "#1e1b4b"];
const colorsLight = ["#881337", "#3b82f6", "#b45309", "#10b981", "#7c2d12", "#0ea5e9", "#ca8a04", "#4f46e5"];

window.onload = async () => {
    const initialIds = [872585, 98]; 
    moviesList = [];
    for (const id of initialIds) {
        const movie = await fetchDualLanguageMovie(`/movie/${id}`);
        if (movie) moviesList.push(movie);
    }
    updateUI();
    resetAndFetchFilteredMovies();
    loadOscarMovies();
    renderCustomLists();
    renderPersonalBitacora();
    renderDiarioMuralTab();
    renderWatchedMoviesTab();
};

async function fetchDualLanguageMovie(endpoint) {
    try {
        const sep = endpoint.includes('?') ? '&' : '?';
        const [dataOverview, dataTitle] = await Promise.all([
            fetchFromTMDb(`${endpoint}${sep}language=${currentLang}`),
            fetchFromTMDb(`${endpoint}${sep}language=${currentTitleLang}`)
        ]);

        if (!dataOverview) return null;

        const mainTitle = (dataTitle && (dataTitle.title || dataTitle.original_title)) 
            ? (dataTitle.title || dataTitle.original_title) 
            : (dataOverview.title || dataOverview.original_title);

        const subTitle = (dataOverview.title || dataOverview.original_title);
        const posterPath = (dataTitle && dataTitle.poster_path) ? dataTitle.poster_path : dataOverview.poster_path;

        return {
            id: dataOverview.id,
            title: mainTitle,
            subtitle: subTitle !== mainTitle ? subTitle : '',
            rating: dataOverview.vote_average ? dataOverview.vote_average.toFixed(1) : '8.0',
            votes: dataOverview.vote_count > 1000 ? (dataOverview.vote_count/1000).toFixed(0) + 'k' : dataOverview.vote_count,
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/150',
            overview: dataOverview.overview || 'Sin descripción disponible.'
        };
    } catch (err) {
        return null;
    }
}

async function fetchFromTMDb(endpoint) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3${endpoint}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${TMDB_BEARER_TOKEN}`, 'Content-Type': 'application/json;charset=utf-8' }
        });
        if (!response.ok) throw new Error("Error en TMDb API");
        return await response.json();
    } catch (err) { return null; }
}

function resetAndFetchFilteredMovies() { currentFilterPage = 1; fetchedResults = []; fetchMultipleFilteredPages(); }
function loadNextFilteredPage() { if (currentFilterPage < totalFilterPages) { currentFilterPage++; fetchFilteredBatch(currentFilterPage); } }

async function fetchMultipleFilteredPages() {
    document.getElementById('catalogCountIndicator').innerText = "Cargando...";
    const genre = document.getElementById('genreSelect').value;
    const minRating = parseFloat(document.getElementById('minRatingInput').value);
    const maxRating = parseFloat(document.getElementById('maxRatingInput').value);
    const sortBy = document.getElementById('sortBySelect').value;
    const minVotes = document.getElementById('minVotes').value;

    let baseEs = `/discover/movie?language=${currentLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}`;
    let baseTitle = `/discover/movie?language=${currentTitleLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}`;
    if (genre) { baseEs += `&with_genres=${genre}`; baseTitle += `&with_genres=${genre}`; }

    const pages = [1, 2, 3];
    const responsesEs = await Promise.all(pages.map(p => fetchFromTMDb(`${baseEs}&page=${p}`)));
    const responsesTitle = await Promise.all(pages.map(p => fetchFromTMDb(`${baseTitle}&page=${p}`)));

    fetchedResults = [];
    responsesEs.forEach((dataEs, index) => {
        if (dataEs && dataEs.results) {
            if (index === 0) totalFilterPages = dataEs.total_pages || 1;
            const titleRes = (responsesTitle[index] && responsesTitle[index].results) ? responsesTitle[index].results : [];
            const mapped = dataEs.results.map((mEs, i) => {
                const mTitle = titleRes[i] || mEs;
                const posterPath = mTitle.poster_path || mEs.poster_path;
                const mainTitle = mTitle.title || mTitle.original_title || mEs.title;
                const subTitle = mEs.title || mEs.original_title;
                return {
                    id: mEs.id,
                    title: mainTitle,
                    subtitle: subTitle !== mainTitle ? subTitle : '',
                    rating: mEs.vote_average ? mEs.vote_average.toFixed(1) : 'N/A',
                    votes: mEs.vote_count > 1000 ? (mEs.vote_count/1000).toFixed(0) + 'k' : (mEs.vote_count || 0),
                    poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/150',
                    overview: mEs.overview || 'Sin descripción disponible.'
                };
            });
            fetchedResults = [...fetchedResults, ...mapped];
        }
    });

    currentFilterPage = 3;
    renderResultsGrid();
    document.getElementById('catalogCountIndicator').innerText = `${fetchedResults.length} obras`;
    document.getElementById('loadMoreBtn').classList.toggle('hidden', currentFilterPage >= totalFilterPages);
}

async function fetchFilteredBatch(page) {
    const genre = document.getElementById('genreSelect').value;
    const minRating = parseFloat(document.getElementById('minRatingInput').value);
    const maxRating = parseFloat(document.getElementById('maxRatingInput').value);
    const sortBy = document.getElementById('sortBySelect').value;
    const minVotes = document.getElementById('minVotes').value;

    let endpointEs = `/discover/movie?language=${currentLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}&page=${page}`;
    let endpointTitle = `/discover/movie?language=${currentTitleLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}&page=${page}`;
    if (genre) { endpointEs += `&with_genres=${genre}`; endpointTitle += `&with_genres=${genre}`; }

    const [dataEs, dataTitle] = await Promise.all([fetchFromTMDb(endpointEs), fetchFromTMDb(endpointTitle)]);
    if (dataEs && dataEs.results) {
        const titleMap = new Map();
        if (dataTitle && dataTitle.results) dataTitle.results.forEach(m => titleMap.set(m.id, { title: m.title || m.original_title, poster: m.poster_path }));
        const newMovies = dataEs.results.map(m => {
            const tData = titleMap.get(m.id) || {};
            const mainTitle = tData.title || m.title || m.original_title;
            const subTitle = m.title || m.original_title;
            return {
                id: m.id,
                title: mainTitle,
                subtitle: subTitle !== mainTitle ? subTitle : '',
                rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
                votes: m.vote_count > 1000 ? (m.vote_count/1000).toFixed(0) + 'k' : (m.vote_count || 0),
                poster: (tData.poster || m.poster_path) ? `https://image.tmdb.org/t/p/w500${tData.poster || m.poster_path}` : 'https://via.placeholder.com/150',
                overview: m.overview || 'Sin descripción disponible.'
            };
        });
        fetchedResults = [...fetchedResults, ...newMovies];
        renderResultsGrid();
        document.getElementById('catalogCountIndicator').innerText = `${fetchedResults.length} obras`;
        document.getElementById('loadMoreBtn').classList.toggle('hidden', currentFilterPage >= totalFilterPages);
    }
}

function applyCatalogFilters() { renderResultsGrid(); }

function renderResultsGrid() {
    const container = document.getElementById('resultsGrid');
    container.innerHTML = '';

    const textFilter = document.getElementById('catalogSearchFilter').value.toLowerCase().trim();
    const watchedFilter = document.getElementById('watchedFilterSelect').value;

    let filtered = fetchedResults.filter(movie => {
        const isWatched = watchedMovies.includes(movie.id);
        if (watchedFilter === 'UNWATCHED' && isWatched) return false;
        if (watchedFilter === 'WATCHED' && !isWatched) return false;
        if (textFilter && !movie.title.toLowerCase().includes(textFilter) && (!movie.subtitle || !movie.subtitle.toLowerCase().includes(textFilter))) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 font-serif text-stone-400 text-xs italic">No se hallaron obras con este filtro.</div>`;
        return;
    }

    filtered.forEach(movie => {
        const isWatched = watchedMovies.includes(movie.id);
        const pReview = personalReviews[movie.id];
        const card = document.createElement('div');
        card.className = `bg-stone-50 dark:bg-stone-900 journal-border p-2 flex flex-col justify-between transition group relative cursor-pointer shadow-sm ${isWatched ? 'opacity-60' : 'hover:border-rose-900'}`;
        
        card.onclick = (e) => {
            if (!e.target.closest('button')) {
                openDetailModal(movie, "Reseña de Catálogo");
            }
        };

        const watchedBtnClass = isWatched ? "bg-emerald-700/20 text-emerald-700 dark:text-emerald-400 journal-border" : "bg-stone-50 dark:bg-stone-900 text-stone-400 hover:text-stone-900 dark:hover:text-white journal-border";
        const watchedIcon = isWatched ? "fa-check" : "fa-eye-slash";

        let reviewBadge = '';
        if (pReview && pReview.rating) {
            reviewBadge = `<div class="absolute top-1.5 left-1.5 bg-stone-900/90 text-stone-100 px-1.5 py-0.5 text-[9px] font-mono font-bold flex items-center space-x-1 journal-border">
                <i class="fa-solid fa-star text-amber-500"></i>
                <span>Tu: ${pReview.rating}</span>
            </div>`;
        }

        const subTitleHtml = movie.subtitle ? `<span class="block text-[10px] font-serif text-stone-500 dark:text-stone-400 italic truncate">${movie.subtitle}</span>` : '';

        card.innerHTML = `
            <div class="relative aspect-[2/3] w-full overflow-hidden journal-border bg-stone-200 dark:bg-stone-950 mb-2">
                <img src="${movie.poster}" onerror="this.src='https://via.placeholder.com/150'" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                ${reviewBadge}
                <button onclick='toggleWatchedStatus(${JSON.stringify(movie).replace(/'/g, "&apos;")}, event)' title="Marcar vista" class="${watchedBtnClass} absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center text-[10px] transition shadow-sm">
                    <i class="fa-solid ${watchedIcon}"></i>
                </button>
                <div class="absolute bottom-1.5 left-1.5 bg-stone-950/80 px-1.5 py-0.5 text-[9px] text-amber-500 font-mono font-bold flex items-center space-x-1">
                    <i class="fa-solid fa-star"></i>
                    <span>${movie.rating}</span>
                </div>
            </div>
            <div class="space-y-1 flex-grow flex flex-col justify-between">
                <div>
                    <h5 class="text-xs font-serif font-semibold group-hover:text-rose-800 dark:group-hover:text-rose-400 transition truncate">${movie.title}</h5>
                    ${subTitleHtml}
                </div>
                <div class="grid grid-cols-2 gap-1 mt-1">
                    <button onclick='openQuickListMenu(${JSON.stringify(movie).replace(/'/g, "&apos;")}, event)' title="Fichar" class="py-1 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 text-[10px] font-mono font-semibold transition flex items-center justify-center space-x-1 journal-border uppercase">
                        <i class="fa-solid fa-folder-plus"></i>
                        <span>Libreta</span>
                    </button>
                    <button onclick='addMovieToRoulette(${JSON.stringify(movie).replace(/'/g, "&apos;")})' class="py-1 bg-rose-900/10 hover:bg-rose-900 text-rose-900 hover:text-stone-100 text-[10px] font-mono font-semibold transition flex items-center justify-center space-x-1 journal-border uppercase">
                        <i class="fa-solid fa-plus"></i>
                        <span>Sorteo</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

async function loadOscarMovies() {
    const container = document.getElementById('oscarListContainer');
    container.innerHTML = `<div class="text-center py-4 text-stone-400 text-xs font-mono"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Consultando archivo...</div>`;
    let filteredDB = OSCAR_DATABASE.filter(m => oscarMode === 'WINNERS' ? m.isWinner : true);
    const results = await Promise.all(filteredDB.slice(0, 15).map(async (item) => {
        const movie = await fetchDualLanguageMovie(`/movie/${item.tmdbId}`);
        if (movie) { movie.oscarYear = item.oscarYear; movie.isWinner = item.isWinner; return movie; }
        return null;
    }));
    currentOscarList = results.filter(m => m !== null);
    renderOscarList();
}

function setOscarFilterMode(mode) {
    oscarMode = mode;
    document.getElementById('btnFilterWinners').className = mode === 'WINNERS' ? "py-1 rounded-none text-xs font-serif font-semibold bg-amber-600 text-stone-50 transition" : "py-1 rounded-none text-xs font-serif font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition";
    document.getElementById('btnFilterAll').className = mode === 'ALL' ? "py-1 rounded-none text-xs font-serif font-semibold bg-amber-600 text-stone-50 transition" : "py-1 rounded-none text-xs font-serif font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition";
    loadOscarMovies();
}

function renderOscarList() {
    const container = document.getElementById('oscarListContainer');
    container.innerHTML = '';
    currentOscarList.forEach(movie => {
        const isWatched = watchedMovies.includes(movie.id);
        const item = document.createElement('div');
        item.className = `flex items-center space-x-2.5 p-2 journal-border transition cursor-pointer ${isWatched ? 'bg-stone-200/50 dark:bg-stone-950/30 opacity-60' : 'bg-stone-50 dark:bg-stone-950 hover:border-amber-600'}`;
        item.onclick = (e) => { if (!e.target.closest('button')) openDetailModal(movie, movie.isWinner ? "🏆 Ganadora del Óscar" : "🎬 Nominada al Óscar"); };
        item.innerHTML = `
            <span class="text-[9px] font-mono font-bold text-amber-700 dark:text-amber-500 bg-amber-500/10 px-1.5 py-0.5 journal-border">${movie.oscarYear}</span>
            <img src="${movie.poster}" onerror="this.src='https://via.placeholder.com/150'" class="w-8 h-11 object-cover journal-border bg-stone-200">
            <div class="flex-grow min-w-0">
                <h4 class="text-xs font-serif font-semibold truncate">${movie.title}</h4>
                <span class="text-[10px] font-mono text-amber-700 dark:text-amber-500 font-bold"><i class="fa-solid fa-star mr-0.5"></i>${movie.rating}</span>
            </div>
            <div class="flex items-center space-x-1 flex-shrink-0">
                <button onclick='toggleWatchedStatus(${JSON.stringify(movie).replace(/'/g, "&apos;")}, event)' title="Marcar vista" class="${isWatched ? "bg-emerald-700/20 text-emerald-700 dark:text-emerald-400 journal-border" : "bg-stone-200 dark:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white journal-border"} p-1.5 text-[10px]"><i class="fa-solid ${isWatched ? 'fa-check' : 'fa-eye-slash'}"></i></button>
                <button onclick='addMovieToRoulette(${JSON.stringify(movie).replace(/'/g, "&apos;")})' title="Añadir a sorteo" class="bg-amber-600/10 hover:bg-amber-600 text-amber-700 dark:text-amber-400 hover:text-stone-50 p-1.5 text-[10px] journal-border"><i class="fa-solid fa-plus"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function getRandomRecommendation() {
    const genre = document.getElementById('genreSelect').value;
    const minRating = document.getElementById('minRatingInput').value;
    const maxRating = document.getElementById('maxRatingInput').value;
    const minVotes = document.getElementById('minVotes').value;
    const sortBy = document.getElementById('sortBySelect').value;

    let endpoint = `/discover/movie?language=${currentLang}&sort_by=${sortBy}&vote_average.gte=${minRating}&vote_average.lte=${maxRating}&vote_count.gte=${minVotes}&page=${Math.floor(Math.random() * 5) + 1}`;
    if (genre) endpoint += `&with_genres=${genre}`;

    const data = await fetchFromTMDb(endpoint);

    if (data && data.results && data.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.results.length);
        const selectedId = data.results[randomIndex].id;

        const randomMovie = await fetchDualLanguageMovie(`/movie/${selectedId}`);
        if (randomMovie) { 
            playVictorySound(); 
            showModal(randomMovie, "Selección al Azar"); 
        }
    }
}

function openDetailModal(movie, tag) {
    currentDetailMovie = movie;
    document.getElementById('detailTag').innerText = tag || "Reseña Crítica";
    
    const titleText = movie.subtitle ? `${movie.title} <span class="block text-xs font-serif text-stone-500 font-normal italic mt-0.5">(${movie.subtitle})</span>` : movie.title;
    document.getElementById('detailTitle').innerHTML = titleText;
    
    document.getElementById('detailRating').innerHTML = `<i class="fa-solid fa-star mr-1"></i>${movie.rating || 'N/A'}`;
    document.getElementById('detailVotes').innerHTML = `<i class="fa-solid fa-users mr-1"></i>${movie.votes || 'N/A'} votos`;
    document.getElementById('detailYear').innerText = movie.oscarYear ? `Año: ${movie.oscarYear}` : '';
    document.getElementById('detailPoster').src = movie.poster;
    
    updateDetailModalWatchedButton(movie.id);

    const pReview = personalReviews[movie.id];
    const isPublicDefault = pReview ? !!pReview.isPublic : true;

    renderStarSelector(pReview ? pReview.rating : 0);
    document.getElementById('userPersonalReview').value = pReview ? pReview.review || '' : '';
    document.getElementById('userPublicReviewCheck').checked = isPublicDefault;

    const overviewEl = document.getElementById('detailOverview');
    overviewEl.innerText = movie.overview || "Sinopsis no disponible.";
    overviewEl.scrollTop = 0;

    renderDetailPublicReviews();

    document.getElementById('detailAddBtn').onclick = () => {
        addMovieToRoulette(movie);
        closeDetailModal();
    };

    document.getElementById('detailModal').classList.remove('hidden');
}

function closeDetailModal() { document.getElementById('detailModal').classList.add('hidden'); }
function addAllOscarsToRoulette() {
    currentOscarList.forEach(m => { if (!watchedMovies.includes(m.id) && !moviesList.some(e => e.id === m.id)) moviesList.push(m); });
    updateUI();
}

function handleAutocompleteInput(query) {
    clearTimeout(autocompleteDebounceTimer);
    const dropdown = document.getElementById('autocompleteDropdown');
    const spinner = document.getElementById('autocompleteSpinner');
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) { dropdown.classList.add('hidden'); spinner.classList.add('hidden'); return; }
    spinner.classList.remove('hidden');

    autocompleteDebounceTimer = setTimeout(async () => {
        const [dataEs, dataTitle] = await Promise.all([
            fetchFromTMDb(`/search/movie?language=${currentLang}&query=${encodeURIComponent(cleanQuery)}&page=1`),
            fetchFromTMDb(`/search/movie?language=${currentTitleLang}&query=${encodeURIComponent(cleanQuery)}&page=1`)
        ]);
        spinner.classList.add('hidden');
        if (dataEs && dataEs.results) {
            const titleMap = new Map();
            if (dataTitle && dataTitle.results) dataTitle.results.forEach(m => titleMap.set(m.id, { title: m.title || m.original_title, poster: m.poster_path }));
            dropdown.innerHTML = '';
            dataEs.results.slice(0, 6).forEach(m => {
                const tData = titleMap.get(m.id) || {};
                const posterPath = tData.poster || m.poster_path;
                const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/150';
                const isWatched = watchedMovies.includes(m.id);
                const selectedTitle = tData.title || m.title || m.original_title;
                const subTitle = m.title || m.original_title;
                const movieObj = { 
                    id: m.id, 
                    title: selectedTitle, 
                    subtitle: subTitle !== selectedTitle ? subTitle : '',
                    rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A', 
                    votes: m.vote_count > 1000 ? (m.vote_count/1000).toFixed(0) + 'k' : m.vote_count, 
                    poster: poster, 
                    overview: m.overview || 'Sin descripción disponible.' 
                };

                const item = document.createElement('div');
                item.className = "flex items-center space-x-2.5 p-2 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer border-b border-stone-200 dark:border-stone-800 last:border-none transition";
                item.onclick = (e) => { if (!e.target.closest('button')) selectAutocompleteMovie(movieObj); };
                item.innerHTML = `
                    <img src="${poster}" onerror="this.src='https://via.placeholder.com/150'" class="w-7 h-10 object-cover journal-border flex-shrink-0 bg-stone-200">
                    <div class="min-w-0 flex-grow">
                        <h4 class="text-xs font-serif font-semibold truncate ${isWatched ? 'line-through opacity-50' : ''}">${selectedTitle}</h4>
                        <div class="flex items-center space-x-2 text-[10px] font-mono text-stone-500">
                            <span>${m.release_date ? m.release_date.split('-')[0] : ''}</span>
                            <span class="text-amber-600"><i class="fa-solid fa-star mr-0.5"></i>${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1 flex-shrink-0">
                        <button onclick='toggleWatchedStatus(${JSON.stringify(movieObj).replace(/'/g, "&apos;")}, event)' title="Marcar vista" class="${isWatched ? "text-emerald-600 font-bold" : "text-stone-400 hover:text-stone-900 dark:hover:text-white"} p-1 text-xs"><i class="fa-solid ${isWatched ? 'fa-check' : 'fa-eye-slash'}"></i></button>
                        <button onclick='openQuickListMenu(${JSON.stringify(movieObj).replace(/'/g, "&apos;")}, event)' title="Fichar" class="text-rose-900 dark:text-rose-400 text-[10px] font-mono bg-rose-900/10 px-2 py-1 journal-border"><i class="fa-solid fa-folder-plus"></i></button>
                    </div>
                `;
                dropdown.appendChild(item);
            });
            dropdown.classList.remove('hidden');
        } else {
            dropdown.innerHTML = `<div class="p-3 text-xs font-serif text-stone-400 text-center italic">Sin coincidencias</div>`;
            dropdown.classList.remove('hidden');
        }
    }, 300);
}

function selectAutocompleteMovie(movie) {
    document.getElementById('manualMovieInput').value = '';
    document.getElementById('autocompleteDropdown').classList.add('hidden');
    openDetailModal(movie, "Búsqueda Directa");
}

function addMovieToRoulette(movie) {
    const mObj = typeof movie === 'string' ? JSON.parse(movie) : movie;
    if (!moviesList.some(m => m.id === mObj.id)) { moviesList.push(mObj); updateUI(); }
}

function addAllFilteredToRoulette() {
    fetchedResults.forEach(m => { if (!watchedMovies.includes(m.id) && !moviesList.some(e => e.id === m.id)) moviesList.push(m); });
    updateUI();
}

function removeMovie(index) { moviesList.splice(index, 1); updateUI(); }
function clearList() { moviesList = []; updateUI(); }

function updateUI() {
    document.getElementById('movieCount').innerText = moviesList.length;
    const container = document.getElementById('movieChipsList');
    container.innerHTML = '';
    if (moviesList.length === 0) { container.innerHTML = `<div class="text-xs font-serif text-stone-400 italic text-center py-3 w-full">Sorteo vacío. Añade obras.</div>`; return; }
    moviesList.forEach((m, idx) => {
        const chip = document.createElement('div');
        chip.className = "flex items-center space-x-1.5 bg-stone-100 dark:bg-stone-950 text-stone-800 dark:text-stone-200 px-2.5 py-1 text-xs journal-border font-serif";
        chip.innerHTML = `<span class="truncate max-w-[110px]">${m.title}</span><button onclick="removeMovie(${idx})" class="text-stone-400 hover:text-rose-800 ml-1 transition"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(chip);
    });
    drawWheel();
}

function drawWheel() {
    const canvas = document.getElementById('rouletteCanvas');
    const ctx = canvas.getContext('2d');
    const numOptions = moviesList.length;
    const width = canvas.width, height = canvas.height, center = width / 2, radius = center - 20;
    const isDark = document.documentElement.classList.contains('dark');
    const activeColors = isDark ? colorsDark : colorsLight;
    ctx.clearRect(0, 0, width, height);

    if (numOptions === 0) {
        ctx.beginPath(); ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "#1a1816" : "#e8e1d5"; ctx.fill();
        ctx.fillStyle = "#78716c"; ctx.font = "bold 24px Playfair Display"; ctx.textAlign = "center";
        ctx.fillText("Seleccione Obras", center, center);
        return;
    }

    const arcSize = (2 * Math.PI) / numOptions;
    for (let i = 0; i < numOptions; i++) {
        const angle = startAngle + i * arcSize;
        ctx.beginPath(); ctx.fillStyle = activeColors[i % activeColors.length];
        ctx.moveTo(center, center); ctx.arc(center, center, radius, angle, angle + arcSize);
        ctx.lineTo(center, center); ctx.fill();
        ctx.strokeStyle = isDark ? "#121110" : "#fcfaf2"; ctx.lineWidth = 3; ctx.stroke();

        ctx.save(); ctx.translate(center, center); ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = "right"; ctx.fillStyle = "#fcfaf2"; ctx.font = "bold 22px Playfair Display";
        let text = moviesList[i].title;
        if (text.length > 18) text = text.substring(0, 16) + "..";
        ctx.fillText(text, radius - 40, 8);
        ctx.restore();
    }

    if (numOptions > 0) {
        const degrees = startAngle * 180 / Math.PI + 90;
        const arclen = 360 / numOptions;
        const currentSegment = Math.floor((360 - (degrees % 360)) / arclen) % numOptions;
        if (currentSegment !== lastSegmentIndex) {
            if (isSpinning) playTickSound();
            lastSegmentIndex = currentSegment;
        }
    }
}

function spinWheel() {
    if (isSpinning || moviesList.length === 0) return;
    getAudioContext();
    isSpinning = true;
    const spinAngleStart = Math.random() * 10 + 20;
    let spinTime = 0;
    const spinTimeTotal = Math.random() * 3000 + 4000;

    function rotate() {
        spinTime += 30;
        if (spinTime >= spinTimeTotal) { stopRotate(); return; }
        const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
        startAngle += (spinAngle * Math.PI / 180);
        drawWheel();
        requestAnimationFrame(rotate);
    }
    rotate();
}

function stopRotate() {
    isSpinning = false;
    const degrees = startAngle * 180 / Math.PI + 90;
    const arclen = 360 / moviesList.length;
    const index = Math.floor((360 - (degrees % 360)) / arclen) % moviesList.length;
    const winner = moviesList[index];
    playVictorySound();
    showModal(winner, "🏆 Selección del Sorteo");
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
}

function easeOut(t, b, c, d) {
    const ts = (t /= d) * t;
    const tc = ts * t;
    return b + c * (tc + -3 * ts + 3 * t);
}

function showModal(movie, tag) {
    currentWinnerMovie = movie;
    document.getElementById('modalTag').innerText = tag;
    document.getElementById('modalTitle').innerText = movie.title;
    document.getElementById('modalRating').innerHTML = `<i class="fa-solid fa-star mr-1"></i>${movie.rating || 'N/A'}`;
    document.getElementById('modalVotes').innerHTML = `<i class="fa-solid fa-users mr-1"></i>${movie.votes || 'N/A'} votos`;
    document.getElementById('modalPoster').src = movie.poster;
    
    const isWatched = watchedMovies.includes(movie.id);
    const winnerBtn = document.getElementById('winnerWatchedBtn');
    winnerBtn.className = isWatched ? "absolute top-2 right-2 bg-emerald-700/20 text-emerald-700 dark:text-emerald-400 journal-border p-1.5 text-xs transition shadow-md" : "absolute top-2 right-2 bg-stone-50 dark:bg-stone-900 text-stone-500 hover:text-stone-900 dark:hover:text-white journal-border p-1.5 text-xs transition shadow-md";
    document.getElementById('winnerWatchedIcon').className = isWatched ? "fa-solid fa-check" : "fa-solid fa-eye-slash";
    winnerBtn.onclick = (e) => toggleWatchedStatus(movie, e);

    document.getElementById('winnerAddListBtn').onclick = (e) => openQuickListMenu(movie, e);
    const overviewEl = document.getElementById('modalOverview');
    overviewEl.innerText = movie.overview;
    overviewEl.scrollTop = 0;
    document.getElementById('winnerModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('winnerModal').classList.add('hidden'); }

let draggedMovieInfo = null;

function handleDragStart(e, listId, index) {
    draggedMovieInfo = { listId, index };
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e, targetListId, targetIndex) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedMovieInfo) return;
    const { listId, index } = draggedMovieInfo;
    
    // Solo reordenar si es dentro del mismo cuaderno
    if (listId === targetListId && index !== targetIndex) {
        const list = customLists.find(l => l.id === listId);
        if (list) {
            const [movedMovie] = list.movies.splice(index, 1);
            list.movies.splice(targetIndex, 0, movedMovie);
            saveAndRenderCustomLists();
        }
    }
    draggedMovieInfo = null;
}

// Avatar por defecto o guardado
let currentAvatarSeed = localStorage.getItem('cine_avatar_seed') || 'Dante';

function getAvatarUrl(seed) {
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

function toggleProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const backdrop = document.getElementById('profileDrawerBackdrop');
    
    if (drawer.classList.contains('translate-x-full')) {
        // Abrir
        updateProfileDrawerStats();
        backdrop.classList.remove('hidden');
        drawer.classList.remove('translate-x-full');
    } else {
        // Cerrar
        drawer.classList.add('translate-x-full');
        backdrop.classList.add('hidden');
    }
}

function updateProfileDrawerStats() {
    // Actualizar nombre y fotos
    document.getElementById('headerUsername').innerText = currentUsername;
    document.getElementById('drawerUsername').innerText = currentUsername;
    
    const avatarUrl = getAvatarUrl(currentAvatarSeed);
    document.getElementById('headerProfileAvatar').src = avatarUrl;
    document.getElementById('drawerProfileAvatar').src = avatarUrl;

    // Actualizar contadores
    document.getElementById('statWatchedCount').innerText = watchedMovies.length;
    document.getElementById('statBitacoraCount').innerText = Object.keys(personalReviews).length;
    document.getElementById('statListsCount').innerText = customLists.length;
}

function changeAvatarPreset() {
    const newSeed = prompt("Ingresa una palabra o nombre para generar un nuevo Avatar:", currentAvatarSeed);
    if (newSeed && newSeed.trim()) {
        currentAvatarSeed = newSeed.trim();
        localStorage.setItem('cine_avatar_seed', currentAvatarSeed);
        updateProfileDrawerStats();
    }
}

function scrollToLists() {
    const listsContainer = document.getElementById('customListsContainer');
    if (listsContainer) {
        listsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Asegurar actualización de UI de perfil al cambiar el usuario
const originalUpdateUsername = updateUsername;
updateUsername = function(val) {
    if (typeof originalUpdateUsername === 'function') originalUpdateUsername(val);
    updateProfileDrawerStats();
};

// Actualizar avatar al iniciar la app
window.addEventListener('DOMContentLoaded', () => {
    updateProfileDrawerStats();
});