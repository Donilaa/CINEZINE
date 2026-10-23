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
let currentUsername = localStorage.getItem('cine_username') || 'Invitado/a';
let sortDirection = "desc";

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
    } catch (e) { }
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
    } catch (e) { }
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
        if (text) text.innerText = "Sonido On";
    } else {
        if (icon) icon.className = "fa-solid fa-volume-xmark text-stone-400";
        if (text) text.innerText = "Muteado";
    }
}

function toggleSettingsModal() {
    resetModalPosition('settingsModal');
    const modal = document.getElementById('settingsModal');
    const uInput = document.getElementById('usernameInput');
    const startPageSelect = document.getElementById('startPageSelect');
    if (uInput) uInput.value = currentUsername;
    if (startPageSelect) startPageSelect.value = defaultMainTab;
    if (modal) modal.classList.toggle('hidden');
}

function updateUsername(val) {
    if (val.trim()) {
        currentUsername = val.trim();
        localStorage.setItem('cine_username', currentUsername);
        updateProfileDrawerStats();
    }
}

function setStartPage(tabName) {
    defaultMainTab = tabName;
    localStorage.setItem('cine_default_tab', tabName);
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
            renderMuralFeed('all');
        }
        if (btnMural) btnMural.className = activeClasses;
    } else if (tabName === 'catalog') {
        if (viewCatalog) viewCatalog.classList.remove('hidden');
        if (btnCatalog) btnCatalog.className = activeClasses;
    } else if (tabName === 'roulette') {
        if (viewRoulette) viewRoulette.classList.remove('hidden');
        if (btnRoulette) btnRoulette.className = activeClasses;
        drawWheel();
    }
}

function filterMural(filter) {
    document.querySelectorAll('.mural-filter-btn').forEach(btn => {
        btn.className = "mural-filter-btn text-stone-500 hover:text-stone-900 dark:hover:text-white px-3 py-1.5 transition";
    });
    if (event && event.currentTarget) {
        event.currentTarget.className = "mural-filter-btn active bg-stone-200 dark:bg-stone-800 px-3 py-1.5 journal-border";
    }
    renderMuralFeed(filter);
}

async function renderMuralFeed(filter = 'all') {
    const feedContainer = document.getElementById('muralPostsFeed');
    if (!feedContainer) return;

    feedContainer.innerHTML = `<div class="col-span-full text-center py-6 text-stone-400 text-xs font-mono"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando muro editorial...</div>`;

    const allPosts = getCommunityAndUserPosts();
    const filtered = allPosts.filter(p => {
        if (filter === 'reviews') return p.type === 'review';
        if (filter === 'discussions') return p.type === 'discussion';
        return true;
    });

    feedContainer.innerHTML = '';

    if (filtered.length === 0) {
        feedContainer.innerHTML = `<div class="col-span-full text-center py-8 text-stone-400 text-xs font-serif italic">No hay publicaciones en esta categoría.</div>`;
        return;
    }

    for (const post of filtered) {
        const card = document.createElement('article');
        card.className = "bg-stone-100 dark:bg-stone-950 journal-border p-4 space-y-3 flex flex-col justify-between hover:border-rose-900 transition cursor-pointer group";
        card.onclick = (e) => {
            if (!e.target.closest('.card-action-btn') && !e.target.closest('.user-profile-trigger')) {
                openMuralPostModal(post.id);
            }
        };

        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(post.avatarSeed || post.author)}`;

        let movieBox = '';
        if (post.type === 'review' && (post.tmdbMovieId || post.movieObj)) {
            let fetchedMovieObj = post.movieObj;
            if (!fetchedMovieObj && post.tmdbMovieId) {
                fetchedMovieObj = await fetchDualLanguageMovie(`/movie/${post.tmdbMovieId}`);
            }

            if (fetchedMovieObj) {
                const score = post.rating || fetchedMovieObj.rating;
                movieBox = `
                    <div class="flex items-center space-x-3 bg-stone-200 dark:bg-stone-900 p-2 journal-border group-hover:border-rose-800 transition">
                        <img src="${fetchedMovieObj.poster}" onerror="this.src='https://via.placeholder.com/150'" class="w-10 h-14 object-cover journal-border flex-shrink-0">
                        <div>
                            <h4 class="font-serif font-bold text-xs group-hover:text-rose-800 dark:group-hover:text-rose-400 transition">${fetchedMovieObj.title}</h4>
                            <span class="text-amber-600 text-xs font-mono"><i class="fa-solid fa-star"></i> ${score}/10</span>
                        </div>
                    </div>
                `;
            }
        }

        let optionalTitleHeading = (post.reviewTitle && post.reviewTitle.trim() !== '')
            ? `<h4 class="font-heading font-bold text-sm text-rose-900 dark:text-rose-400">${post.reviewTitle}</h4>`
            : (post.title ? `<h3 class="font-heading font-bold text-sm text-rose-900 dark:text-rose-400 group-hover:underline">${post.title}</h3>` : '');

        let previewCommentHtml = '';
        const allComments = post.comments || [];
        if (allComments.length > 0) {
            const lastComm = allComments[allComments.length - 1];
            previewCommentHtml = `
                <div class="text-[11px] font-serif bg-stone-200/40 dark:bg-stone-900 p-2 journal-border border-dashed italic text-stone-600 dark:text-stone-400 truncate">
                    <span class="font-bold not-italic text-stone-800 dark:text-stone-200 user-profile-trigger cursor-pointer hover:underline" onclick="event.stopPropagation(); openUserProfileModal('${lastComm.author}', '${lastComm.avatarSeed || lastComm.author}', 'Crítico')">${lastComm.author}:</span> "${lastComm.text}"
                </div>
            `;
        }

        const reactions = post.reactions || { agree: 0, disagree: 0 };
        const userVote = post.userVotes ? post.userVotes[currentUsername] : null;

        const agreeActive = userVote === 'agree' ? 'bg-emerald-800/30 text-emerald-500 font-bold' : 'hover:bg-stone-200 dark:hover:bg-stone-800';
        const disagreeActive = userVote === 'disagree' ? 'bg-rose-800/30 text-rose-500 font-bold' : 'hover:bg-stone-200 dark:hover:bg-stone-800';

        card.innerHTML = `
            <div class="space-y-2">
                <div class="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                    <div class="flex items-center space-x-2 user-profile-trigger cursor-pointer hover:opacity-80 transition" onclick="openUserProfileModal('${post.author}', '${post.avatarSeed || post.author}', '${post.role || 'Crítico'}')">
                        <img src="${avatarUrl}" class="w-7 h-7 rounded-full journal-border bg-stone-300">
                        <div>
                            <span class="block font-heading text-xs font-bold hover:underline">${post.author}</span>
                            <span class="block text-[9px] font-mono text-stone-500 uppercase">${post.role || 'Crítico'}</span>
                        </div>
                    </div>
                    <span class="text-[10px] font-mono text-stone-400">${post.date}</span>
                </div>
                ${movieBox}
                ${optionalTitleHeading}
                <p class="font-serif text-xs text-stone-700 dark:text-stone-300 leading-relaxed line-clamp-2">"${post.content}"</p>
                ${previewCommentHtml}
            </div>
            <div class="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-mono">
                <div class="flex items-center space-x-2">
                    <button onclick="event.stopPropagation(); reactToMuralPost('${post.id}', 'agree')" class="card-action-btn bg-stone-200 dark:bg-stone-900 px-2 py-1 journal-border transition flex items-center space-x-1 ${agreeActive}">
                        <i class="fa-solid fa-thumbs-up text-emerald-600"></i><span>${reactions.agree || 0}</span>
                    </button>
                    <button onclick="event.stopPropagation(); reactToMuralPost('${post.id}', 'disagree')" class="card-action-btn bg-stone-200 dark:bg-stone-900 px-2 py-1 journal-border transition flex items-center space-x-1 ${disagreeActive}">
                        <i class="fa-solid fa-thumbs-down text-rose-600"></i><span>${reactions.disagree || 0}</span>
                    </button>
                    <button onclick="event.stopPropagation(); openMuralPostModal('${post.id}')" class="card-action-btn bg-stone-200 dark:bg-stone-900 px-2 py-1 journal-border transition flex items-center space-x-1 hover:bg-stone-300 dark:hover:bg-stone-800" title="Ver comentarios y debate">
                        <i class="fa-solid fa-comments"></i><span>${allComments.length}</span>
                    </button>
                </div>
                <span class="text-rose-800 dark:text-rose-400 font-bold hover:underline">Ver debate →</span>
            </div>
        `;
        feedContainer.appendChild(card);
    }
}

function openUserProfileModal(username, avatarSeed, role) {
    let modal = document.getElementById('userProfileModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'userProfileModal';
        modal.className = 'fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[150] hidden flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }

    const isMe = username === currentUsername;
    const bio = isMe ? currentUserBio : `Apasionado crítico de cine y analista de obras cinematográficas en CineZine.`;
    const avatarUrl = isMe ? getAvatarUrl() : `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`;

    const statWatched = isMe ? watchedMovies.length : 14;
    const statReviews = isMe ? Object.keys(personalReviews).length : 6;
    const statLists = isMe ? customLists.length : 3;

    modal.innerHTML = `
        <div class="bg-stone-50 dark:bg-stone-900 journal-border rounded-none max-w-sm w-full p-6 space-y-4 text-center relative shadow-2xl z-[155]">
            <button onclick="document.getElementById('userProfileModal').classList.add('hidden')" class="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-white text-base transition"><i class="fa-solid fa-xmark"></i></button>
            
            <div class="relative w-24 h-24 mx-auto mt-2">
                <img src="${avatarUrl}" class="w-24 h-24 rounded-full journal-border shadow-md object-cover bg-stone-200 dark:bg-stone-900">
            </div>

            <div class="space-y-1">
                <h3 class="font-heading font-bold text-lg text-stone-900 dark:text-stone-100">${username}</h3>
                <span class="inline-block text-[10px] font-mono tracking-widest uppercase bg-rose-900/10 text-rose-800 dark:text-rose-400 journal-border px-2 py-0.5">${role}</span>
                <p class="text-xs font-serif italic text-stone-600 dark:text-stone-400 pt-2 px-2 leading-relaxed">"${bio}"</p>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 text-center font-mono">
                <div onclick="openUserStatsDetail('${username}', 'watched')" class="bg-stone-100 dark:bg-stone-950 p-2 journal-border cursor-pointer hover:border-rose-900 transition">
                    <span class="block text-sm font-bold text-amber-600">${statWatched}</span>
                    <span class="text-[9px] text-stone-500 uppercase">Vistas</span>
                </div>
                <div onclick="openUserStatsDetail('${username}', 'reviews')" class="bg-stone-100 dark:bg-stone-950 p-2 journal-border cursor-pointer hover:border-rose-900 transition">
                    <span class="block text-sm font-bold text-rose-800 dark:text-rose-400">${statReviews}</span>
                    <span class="text-[9px] text-stone-500 uppercase">Apuntes</span>
                </div>
                <div onclick="openUserStatsDetail('${username}', 'lists')" class="bg-stone-100 dark:bg-stone-950 p-2 journal-border cursor-pointer hover:border-rose-900 transition">
                    <span class="block text-sm font-bold text-stone-700 dark:text-stone-300">${statLists}</span>
                    <span class="text-[9px] text-stone-500 uppercase">Cuadernos</span>
                </div>
            </div>

            <button onclick="document.getElementById('userProfileModal').classList.add('hidden')" class="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider">Cerrar ficha</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

async function openUserStatsDetail(username, type) {
    let detailModal = document.getElementById('userStatsDetailModal');
    if (!detailModal) {
        detailModal = document.createElement('div');
        detailModal.id = 'userStatsDetailModal';
        detailModal.className = 'fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-[200] hidden flex items-center justify-center p-4';
        document.body.appendChild(detailModal);
    }

    const isMe = username === currentUsername;
    let titleHeader = "";
    let contentHtml = "";

    if (type === 'watched') {
        titleHeader = `Películas vistas de ${username}`;
        let items = [];
        if (isMe) {
            items = watchedMovies.map(id => watchedMoviesData[id] || { id: id, title: `Película ID: ${id}`, poster: 'https://via.placeholder.com/150' });
        } else {
            items = [
                { id: 872585, title: "Oppenheimer", rating: "9.0", poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", overview: "La historia del físico J. Robert Oppenheimer..." },
                { id: 792307, title: "Pobres Criaturas", rating: "8.5", poster: "https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg", overview: "La fantástica evolución de Bella Baxter..." },
                { id: 693134, title: "Dune: Parte Dos", rating: "9.2", poster: "https://image.tmdb.org/t/p/w500/5buioST91U2K64T6jVj2lW2k9y2.jpg", overview: "Paul Atreides se une a Chani y a los fremen..." }
            ];
        }

        if (items.length === 0) {
            contentHtml = `<p class="text-xs font-serif italic text-stone-400 text-center py-6">No hay registros de películas vistas.</p>`;
        } else {
            contentHtml = `<ul class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">`;
            items.forEach(m => {
                const titleStr = m.title || m;
                const movieId = m.id || 872585;
                contentHtml += `
                    <li onclick="closeUserStatsDetailModal(); openDetailModal({id: ${movieId}, title: '${titleStr}', poster: '${m.poster || 'https://via.placeholder.com/150'}', rating: '${m.rating || '8.0'}', overview: '${m.overview || 'Sin descripción'}'}, 'Película de ${username}')" class="bg-stone-100 dark:bg-stone-950 p-2.5 journal-border text-xs font-serif flex items-center justify-between cursor-pointer hover:border-rose-900 transition">
                        <span class="font-bold text-rose-900 dark:text-rose-400">🎬 ${titleStr}</span>
                        <span class="text-[10px] font-mono text-stone-400">Ver detalle →</span>
                    </li>
                `;
            });
            contentHtml += `</ul>`;
        }
    } else if (type === 'reviews') {
        titleHeader = `Apuntes y reseñas de ${username}`;
        let revs = [];
        if (isMe) {
            const allPosts = getCommunityAndUserPosts();
            revs = allPosts.filter(p => p.author === currentUsername && p.type === 'review').map(p => ({
                postId: p.id,
                reviewTitle: p.reviewTitle || 'Reseña de película',
                review: p.content,
                movieTitle: p.movieObj ? p.movieObj.title : 'Reseña'
            }));
        } else {
            revs = [
                { postId: 'comm_2', reviewTitle: "¿El cine de autor está perdiendo espacio?", review: "Abro debate: cada vez cuesta más encontrar películas independientes en salas tradicionales...", movieTitle: "Muro de debate" }
            ];
        }

        if (revs.length === 0) {
            contentHtml = `<p class="text-xs font-serif italic text-stone-400 text-center py-6">Este usuario aún no publica apuntes en su bitácora.</p>`;
        } else {
            contentHtml = `<div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">`;
            revs.forEach(r => {
                contentHtml += `
                    <div onclick="closeUserStatsDetailModal(); openMuralPostModal('${r.postId}')" class="bg-stone-100 dark:bg-stone-950 p-3 journal-border space-y-1 text-xs cursor-pointer hover:border-rose-900 transition">
                        <div class="flex items-center justify-between font-mono text-[10px] text-stone-400">
                            <span>${r.movieTitle}</span>
                            <span class="text-rose-800 dark:text-rose-400 font-bold">Ver en mural →</span>
                        </div>
                        <h5 class="font-heading font-bold text-rose-900 dark:text-rose-400">${r.reviewTitle}</h5>
                        <p class="font-serif italic text-stone-700 dark:text-stone-300 line-clamp-2">"${r.review}"</p>
                    </div>
                `;
            });
            contentHtml += `</div>`;
        }
    } else if (type === 'lists') {
        titleHeader = `Cuadernos temáticos de ${username}`;
        let lists = [];
        if (isMe) {
            lists = customLists;
        } else {
            lists = [
                { name: "Cine de autor contemporáneo", movies: [{ id: 872585, title: "Oppenheimer", poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" }, { id: 792307, title: "Pobres Criaturas", poster: "https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg" }] },
                { name: "Joyas ocultas de los 90s", movies: [{ id: 680, title: "Pulp Fiction", poster: "https://image.tmdb.org/t/p/w500/fIE3L2c322LFi2M3R2921.jpg" }, { id: 275, title: "Fargo", poster: "https://image.tmdb.org/t/p/w500/52531.jpg" }] }
            ];
        }

        if (lists.length === 0) {
            contentHtml = `<p class="text-xs font-serif italic text-stone-400 text-center py-6">No hay cuadernos temáticos creados.</p>`;
        } else {
            contentHtml = `<div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">`;
            lists.forEach(l => {
                contentHtml += `
                    <div onclick="openUserListContentModal('${l.name}', ${JSON.stringify(l.movies || []).replace(/"/g, '&quot;')})" class="bg-stone-100 dark:bg-stone-950 p-3 journal-border flex items-center justify-between text-xs font-serif cursor-pointer hover:border-rose-900 transition">
                        <span class="font-bold text-rose-900 dark:text-rose-400">📓 ${l.name}</span>
                        <span class="text-[10px] font-mono bg-stone-200 dark:bg-stone-900 px-2 py-0.5 journal-border">${l.movies ? l.movies.length : 0} películas →</span>
                    </div>
                `;
            });
            contentHtml += `</div>`;
        }
    }

    detailModal.innerHTML = `
        <div class="bg-stone-50 dark:bg-stone-900 journal-border rounded-none max-w-md w-full p-6 space-y-4 text-left relative shadow-2xl">
            <button onclick="document.getElementById('userStatsDetailModal').classList.add('hidden')" class="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-white text-base transition"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="font-heading font-bold text-sm text-rose-900 dark:text-rose-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 pb-2">${titleHeader}</h3>
            ${contentHtml}
            <button onclick="document.getElementById('userStatsDetailModal').classList.add('hidden')" class="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider">Regresar</button>
        </div>
    `;
    detailModal.classList.remove('hidden');
}

function closeUserStatsDetailModal() {
    const m1 = document.getElementById('userStatsDetailModal');
    const m2 = document.getElementById('userProfileModal');
    if (m1) m1.classList.add('hidden');
    if (m2) m2.classList.add('hidden');
}

function openUserListContentModal(listName, moviesArray) {
    let listModal = document.getElementById('userListContentModal');
    if (!listModal) {
        listModal = document.createElement('div');
        listModal.id = 'userListContentModal';
        listModal.className = 'fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-[210] hidden flex items-center justify-center p-4';
        document.body.appendChild(listModal);
    }

    let moviesHtml = '';
    if (!moviesArray || moviesArray.length === 0) {
        moviesHtml = `<p class="text-xs font-serif italic text-stone-400 text-center py-4">Este cuaderno no contiene películas guardadas.</p>`;
    } else {
        moviesHtml = `<ul class="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">`;
        moviesArray.forEach(m => {
            const mTitle = m.title || m;
            const movieId = m.id || 872585;
            const poster = m.poster || 'https://via.placeholder.com/150';
            const rating = m.rating || '8.5';
            const overview = m.overview || 'Sin descripción disponible.';

            moviesHtml += `
                <li onclick="closeUserListContentModal(); openDetailModal({id: ${movieId}, title: '${mTitle}', poster: '${poster}', rating: '${rating}', overview: '${overview}'}, 'Cuaderno: ${listName}')" 
                    class="bg-stone-100 dark:bg-stone-950 p-2.5 journal-border text-xs font-serif text-stone-800 dark:text-stone-200 flex items-center justify-between cursor-pointer hover:border-rose-900 transition group">
                    <span class="font-bold group-hover:text-rose-800 dark:group-hover:text-rose-400 transition">🎬 ${mTitle}</span>
                    <span class="text-[10px] font-mono text-stone-400">Ver película →</span>
                </li>`;
        });
        moviesHtml += `</ul>`;
    }

    listModal.innerHTML = `
        <div class="bg-stone-50 dark:bg-stone-900 journal-border rounded-none max-w-sm w-full p-6 space-y-4 text-left relative shadow-2xl">
            <button onclick="document.getElementById('userListContentModal').classList.add('hidden')" class="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-white text-base transition"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="font-heading font-bold text-sm text-rose-900 dark:text-rose-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 pb-2">📓 Cuaderno: ${listName}</h3>
            ${moviesHtml}
            <button onclick="document.getElementById('userListContentModal').classList.add('hidden')" class="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono text-xs journal-border transition uppercase tracking-wider">Cerrar</button>
        </div>
    `;
    listModal.classList.remove('hidden');
}

function closeUserListContentModal() {
    const listModal = document.getElementById('userListContentModal');
    const statsModal = document.getElementById('userStatsDetailModal');
    const profileModal = document.getElementById('userProfileModal');
    if (listModal) listModal.classList.add('hidden');
    if (statsModal) statsModal.classList.add('hidden');
    if (profileModal) profileModal.classList.add('hidden');
}

function toggleWatchedStatus(movieId) {
    if (!movieId) return;

    const index = watchedMovies.indexOf(movieId);
    if (index > -1) {
        watchedMovies.splice(index, 1);
        delete watchedMoviesData[movieId];
    } else {
        watchedMovies.push(movieId);
        if (currentDetailMovie) {
            watchedMoviesData[movieId] = {
                id: currentDetailMovie.id,
                title: currentDetailMovie.title,
                poster: currentDetailMovie.poster,
                rating: currentDetailMovie.rating,
                overview: currentDetailMovie.overview
            };
        }
    }

    localStorage.setItem('cine_watched_movies', JSON.stringify(watchedMovies));
    localStorage.setItem('cine_watched_movies_data', JSON.stringify(watchedMoviesData));

    updateWatchedBtnUI(movieId);
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

function openDetailModal(movie, tag) {
    resetModalPosition('detailModal');

    // Resetea cualquier tamaño personalizado previo para que nazca con su tamaño original
    const modalContent = document.querySelector('#detailModal .draggable-modal-content');
    if (modalContent) {
        modalContent.style.width = '';
        modalContent.style.height = '';
        modalContent.style.maxWidth = '';
        modalContent.style.maxHeight = '';
    }

    currentDetailMovie = movie;
    const detailTag = document.getElementById('detailTag');
    if (detailTag) detailTag.innerText = tag || "Reseña crítica";

    const detailTitle = document.getElementById('detailTitle');
    if (detailTitle) detailTitle.innerHTML = movie.title;

    const detailPoster = document.getElementById('detailPoster');
    if (detailPoster) detailPoster.src = movie.poster;

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
        detailOverview.style.height = ''; // Limpia alturas fijas guardadas
        detailOverview.innerText = movie.overview || 'Sin descripción disponible.';
    }

    const watchedBtn = document.getElementById('detailWatchedBtn');
    if (watchedBtn) {
        watchedBtn.onclick = () => toggleWatchedStatus(movie.id);
        updateWatchedBtnUI(movie.id);
    }

    const pReview = personalReviews[movie.id];
    renderStarSelector(pReview ? pReview.rating : 0);

    const userReviewInput = document.getElementById('userPersonalReview');
    if (userReviewInput) {
        userReviewInput.value = pReview ? pReview.review || '' : '';
        // Ajusta la altura del textarea según el texto que se acaba de inyectar
        setTimeout(() => autoResizeTextarea(userReviewInput), 50);
    }

    const userReviewTitleInput = document.getElementById('userReviewTitleInput');
    if (userReviewTitleInput) userReviewTitleInput.value = pReview ? pReview.reviewTitle || '' : '';

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
}

function showWinnerModal(movie) {
    resetModalPosition('winnerModal');
    currentWinnerMovie = movie;

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.innerText = movie.title;

    const modalPoster = document.getElementById('modalPoster');
    if (modalPoster) modalPoster.src = movie.poster;

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

    const modal = document.getElementById('winnerModal');
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('winnerModal');
    if (modal) modal.classList.add('hidden');
}

function renderStarSelector(val) {
    selectedStarRating = val || 0;
    const container = document.getElementById('starContainer');
    if (!container) return;
    container.innerHTML = '';
    const textEl = document.getElementById('starRatingText');
    if (textEl) textEl.innerText = selectedStarRating.toFixed(1);

    for (let i = 1; i <= 10; i++) {
        const starWrapper = document.createElement('div');
        starWrapper.className = "relative cursor-pointer text-sm px-0.5 text-stone-300 dark:text-stone-700";
        const isFull = selectedStarRating >= i;
        let iconClass = isFull ? "fa-solid fa-star text-amber-600" : "fa-regular fa-star text-stone-300 dark:text-stone-700";
        starWrapper.innerHTML = `<i class="${iconClass}"></i>`;
        starWrapper.onclick = () => { selectedStarRating = i; renderStarSelector(selectedStarRating); };
        container.appendChild(starWrapper);
    }
}

function clearPersonalRating() { selectedStarRating = 0; renderStarSelector(0); }

function savePersonalReview() {
    if (!currentDetailMovie) return;
    const reviewInput = document.getElementById('userPersonalReview').value.trim();
    const reviewTitleInput = document.getElementById('userReviewTitleInput') ? document.getElementById('userReviewTitleInput').value.trim() : '';
    const isPublic = document.getElementById('userPublicReviewCheck').checked;

    personalReviews[currentDetailMovie.id] = {
        movie: currentDetailMovie,
        rating: selectedStarRating > 0 ? selectedStarRating : null,
        review: reviewInput,
        reviewTitle: reviewTitleInput,
        isPublic: isPublic
    };
    localStorage.setItem('cine_personal_reviews', JSON.stringify(personalReviews));

    const indicator = document.getElementById('saveStatusIndicator');
    if (indicator) {
        indicator.classList.remove('hidden');
        setTimeout(() => indicator.classList.add('hidden'), 2500);
    }
}

function createNewList() {
    const input = document.getElementById('newListInput');
    const name = input.value.trim();
    if (!name) return;
    customLists.push({ id: Date.now(), name: name, movies: [] });
    saveAndRenderCustomLists();
    input.value = '';
}

function saveAndRenderCustomLists() {
    localStorage.setItem('cine_custom_lists', JSON.stringify(customLists));
    renderCustomLists();
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
        const item = document.createElement('div');
        item.className = "bg-stone-100 dark:bg-stone-950 journal-border overflow-hidden transition-all";

        let headerHtml = `
            <div class="p-3 flex items-center justify-between bg-stone-100 dark:bg-stone-950 hover:bg-stone-200/50 dark:hover:bg-stone-900 transition select-none">
                <div onclick="toggleListAccordion(${listIndex})" class="flex items-center space-x-2 flex-grow cursor-pointer">
                    <i class="fa-solid fa-book text-rose-800 text-xs"></i>
                    <h4 class="text-xs font-heading font-bold text-rose-900 dark:text-rose-400">${list.name}</h4>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <span class="text-[10px] font-mono bg-stone-200 dark:bg-stone-900 px-2 py-0.5 journal-border">${list.movies ? list.movies.length : 0} obras</span>
                    <button onclick="confirmDeleteCustomList(${listIndex})" title="Eliminar cuaderno" class="text-stone-400 hover:text-rose-600 px-1 py-0.5 text-xs transition"><i class="fa-solid fa-trash-can"></i></button>
                    <button onclick="toggleListAccordion(${listIndex})" class="text-stone-400 hover:text-stone-800 dark:hover:text-white text-xs px-1">
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
                const poster = m.poster || 'https://via.placeholder.com/150';

                moviesContentHtml += `
                    <div draggable="true" 
                         ondragstart="onDragStartMovie(event, ${listIndex}, ${mIndex})" 
                         ondragover="onDragOverMovie(event)" 
                         ondrop="onDropMovie(event, ${listIndex}, ${mIndex})" 
                         class="flex items-center justify-between bg-stone-100 dark:bg-stone-950 p-2 journal-border text-xs group cursor-grab active:cursor-grabbing hover:border-rose-800 transition">
                        <div class="flex items-center space-x-2 overflow-hidden flex-grow" onclick="openDetailModal({id: ${movieId}, title: '${mTitle}', poster: '${poster}', rating: '${m.rating || '8.5'}', overview: '${m.overview || 'Sin descripción'}'}, 'Cuaderno: ${list.name}')">
                            <i class="fa-solid fa-grip-vertical text-stone-400 text-[10px] group-hover:text-stone-700 dark:group-hover:text-stone-200"></i>
                            <span class="font-mono text-[10px] text-stone-400 w-4 text-right">${mIndex + 1}.</span>
                            <span class="font-serif font-bold text-stone-800 dark:text-stone-200 truncate hover:text-rose-800 dark:hover:text-rose-400 transition">${mTitle}</span>
                        </div>
                        <button onclick="confirmRemoveMovieFromList(${listIndex}, ${movieId})" title="Quitar de la lista" class="text-stone-400 hover:text-rose-600 px-1.5 py-0.5 text-xs transition"><i class="fa-solid fa-xmark"></i></button>
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

function confirmDeleteCustomList(listIndex) {
    const listName = customLists[listIndex].name;
    showDeleteConfirmationModal(() => {
        customLists.splice(listIndex, 1);
        saveAndRenderCustomLists();
    }, `¿Eliminar el cuaderno "${listName}"? Se perderán las obras guardadas en él.`);
}

function confirmRemoveMovieFromList(listIndex, movieId) {
    showDeleteConfirmationModal(() => {
        customLists[listIndex].movies = customLists[listIndex].movies.filter(m => m.id !== movieId);
        saveAndRenderCustomLists();
        setTimeout(() => mantenerAcordeonAbierto(listIndex), 50);
    }, `¿Quitar esta obra del cuaderno?`);
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

function moveMovieInList(listIndex, movieIndex, direction) {
    const targetIndex = movieIndex + direction;
    if (targetIndex < 0 || targetIndex >= customLists[listIndex].movies.length) return;

    const movies = customLists[listIndex].movies;
    const temp = movies[movieIndex];
    movies[movieIndex] = movies[targetIndex];
    movies[targetIndex] = temp;

    saveAndRenderCustomLists();
    // Mantener abierto el acordeón tras ordenar
    setTimeout(() => {
        const body = document.getElementById(`listBody_${listIndex}`);
        const chevron = document.getElementById(`listChevron_${listIndex}`);
        if (body) body.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    }, 50);
}

function removeMovieFromList(listIndex, movieId) {
    customLists[listIndex].movies = customLists[listIndex].movies.filter(m => m.id !== movieId);
    saveAndRenderCustomLists();
    setTimeout(() => {
        const body = document.getElementById(`listBody_${listIndex}`);
        const chevron = document.getElementById(`listChevron_${listIndex}`);
        if (body) body.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    }, 50);
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

function renderCommentsTreeHtml(postId, comments) {
    if (!comments || comments.length === 0) {
        return `<div class="text-center py-4 text-stone-400 text-xs font-serif italic">Aún no hay comentarios en este debate. ¡Sé el primero en aportar!</div>`;
    }

    const mainComments = comments.filter(c => !c.parentId);
    let html = '';

    mainComments.forEach(c => {
        html += renderSingleCommentBlock(postId, c, false);

        const replies = comments.filter(r => r.parentId === c.id);
        if (replies.length > 0) {
            html += `<div class="ml-6 border-l-2 border-rose-900/40 pl-3 space-y-2 mt-2">`;
            replies.forEach(reply => {
                html += renderSingleCommentBlock(postId, reply, true);
            });
            html += `</div>`;
        }
    });

    return html;
}

function formatCommentText(text) {
    if (!text) return '';
    return text.replace(/(@[a-zA-Z0-9_ÁÉÍÓÚáéíóúÑñ]+)/g, '<span class="text-rose-800 dark:text-rose-400 font-bold">$1</span>');
}

function renderSingleCommentBlock(postId, c, isReply = false) {
    const cAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(c.avatarSeed || c.author)}`;
    const isAuthor = c.author === currentUsername;
    const cReactions = c.reactions || { agree: 0, disagree: 0 };
    const userVote = c.userVotes ? c.userVotes[currentUsername] : null;

    const agreeActive = userVote === 'agree' ? 'bg-emerald-800/40 text-emerald-400 font-bold' : '';
    const disagreeActive = userVote === 'disagree' ? 'bg-rose-800/40 text-rose-400 font-bold' : '';

    let actionButtons = '';
    if (isAuthor) {
        actionButtons = `
            <button onclick="enableEditComment('${postId}', '${c.id}')" class="text-stone-500 hover:text-stone-900 dark:hover:text-white"><i class="fa-solid fa-pen mr-0.5"></i>Editar</button>
            <button onclick="deleteMuralComment('${postId}', '${c.id}')" class="text-rose-800 hover:text-rose-600"><i class="fa-solid fa-trash mr-0.5"></i>Borrar</button>
        `;
    }

    const parentIdForReply = isReply ? c.parentId : c.id;
    const formattedText = formatCommentText(c.text);

    return `
        <div id="commentRow_${c.id}" class="bg-stone-200/50 dark:bg-stone-900 p-2.5 journal-border text-xs space-y-1.5">
            <div class="flex items-start space-x-2.5">
                <img src="${cAvatar}" class="w-6 h-6 rounded-full journal-border bg-stone-300 flex-shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition" onclick="openUserProfileModal('${c.author}', '${c.avatarSeed || c.author}', 'Crítico')">
                <div class="space-y-1 flex-grow">
                    <div class="flex items-center justify-between">
                        <span class="font-heading font-bold cursor-pointer hover:underline" onclick="openUserProfileModal('${c.author}', '${c.avatarSeed || c.author}', 'Crítico')">${c.author}</span>
                        <span class="text-[9px] font-mono text-stone-400">${c.date || 'Reciente'}</span>
                    </div>
                    <p id="commentText_${c.id}" class="font-serif text-stone-700 dark:text-stone-300 leading-relaxed">${formattedText}</p>
                    
                    <div class="flex items-center justify-between pt-1 border-t border-stone-300/40 dark:border-stone-800/60">
                        <div class="flex items-center space-x-2 text-[10px] font-mono">
                            <button onclick="setReplyTarget('${postId}', '${parentIdForReply}', '${c.author}')" class="text-rose-800 dark:text-rose-400 font-bold hover:underline"><i class="fa-solid fa-reply mr-1"></i>Responder</button>
                            ${actionButtons}
                        </div>
                        <div class="flex items-center space-x-1.5 text-[10px] font-mono ml-auto">
                            <button onclick="reactToComment('${postId}', '${c.id}', 'agree')" class="hover:text-emerald-600 flex items-center space-x-1 bg-stone-300/50 dark:bg-stone-800 px-1.5 py-0.5 journal-border cursor-pointer ${agreeActive}" title="Acuerdo">
                                <i class="fa-solid fa-thumbs-up text-emerald-600 text-[9px]"></i><span>${cReactions.agree || 0}</span>
                            </button>
                            <button onclick="reactToComment('${postId}', '${c.id}', 'disagree')" class="hover:text-rose-600 flex items-center space-x-1 bg-stone-300/50 dark:bg-stone-800 px-1.5 py-0.5 journal-border cursor-pointer ${disagreeActive}" title="Discrepo">
                                <i class="fa-solid fa-thumbs-down text-rose-600 text-[9px]"></i><span>${cReactions.disagree || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setReplyTarget(postId, commentId, authorName) {
    replyingTargetMap[postId] = { commentId: commentId, author: authorName };
    const input = document.getElementById(`newCommentInput_${postId}`);
    const indicator = document.getElementById(`replyIndicator_${postId}`);

    if (input) {
        input.value = `@${authorName} `;
        input.focus();
    }
    if (indicator) {
        indicator.classList.remove('hidden');
        indicator.innerHTML = `Respondiendo a <strong>@${authorName}</strong> <button onclick="clearReplyTarget('${postId}')" class="ml-1 text-rose-800 hover:underline"><i class="fa-solid fa-xmark"></i></button>`;
    }
}

function clearReplyTarget(postId) {
    delete replyingTargetMap[postId];
    const input = document.getElementById(`newCommentInput_${postId}`);
    const indicator = document.getElementById(`replyIndicator_${postId}`);
    if (input) {
        if (input.value.startsWith('@')) {
            input.value = '';
        }
        input.placeholder = "Añadir un apunte al debate...";
    }
    if (indicator) indicator.classList.add('hidden');
}

function openMuralPostModal(postId) {
    resetModalPosition('muralPostModal');
    const allPosts = getCommunityAndUserPosts();
    let post = allPosts.find(p => p.id === postId);
    if (!post) return;

    let modal = document.getElementById('muralPostModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'muralPostModal';
        modal.className = 'fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[120] hidden flex items-center justify-center p-4';
        document.body.appendChild(modal);
    }

    const comments = post.comments || [];
    const reactions = post.reactions || { agree: 0, disagree: 0 };
    const userVote = post.userVotes ? post.userVotes[currentUsername] : null;

    const agreeActive = userVote === 'agree' ? 'bg-emerald-800/40 text-emerald-400 font-bold' : '';
    const disagreeActive = userVote === 'disagree' ? 'bg-rose-800/40 text-rose-400 font-bold' : '';

    const commentsTreeHtml = renderCommentsTreeHtml(postId, comments);

    let headerBlockHtml = '';
    if (post.type === 'review' && (post.tmdbMovieId || post.movieObj)) {
        let fetchedMovieObj = post.movieObj;
        if (fetchedMovieObj) {
            const score = post.rating || fetchedMovieObj.rating || 'N/A';
            const optionalTitleHtml = (post.reviewTitle && post.reviewTitle.trim() !== '')
                ? `<h3 class="font-heading font-bold text-sm text-rose-900 dark:text-rose-400 mt-1">${post.reviewTitle}</h3>`
                : '';

            const movieDataJson = JSON.stringify({
                id: fetchedMovieObj.id || post.tmdbMovieId,
                title: fetchedMovieObj.title,
                poster: fetchedMovieObj.poster,
                rating: score,
                overview: fetchedMovieObj.overview || 'Sin descripción disponible.'
            }).replace(/"/g, '&quot;');

            headerBlockHtml = `
                <div class="space-y-1.5">
                    <div onclick="openDetailModal(${movieDataJson}, 'Reseña cinematográfica')" 
                         class="flex items-center space-x-3 bg-stone-200 dark:bg-stone-900 p-2 journal-border cursor-pointer hover:border-rose-900 transition group">
                        <img src="${fetchedMovieObj.poster}" onerror="this.src='https://via.placeholder.com/150'" class="w-10 h-14 object-cover journal-border flex-shrink-0 group-hover:opacity-90 transition">
                        <div>
                            <span class="text-[9px] font-mono uppercase tracking-wider text-rose-800 dark:text-rose-400 font-bold">Reseña cinematográfica</span>
                            <h4 class="font-serif font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-rose-800 dark:group-hover:text-rose-400 transition">${fetchedMovieObj.title}</h4>
                            <span class="text-amber-600 text-xs font-mono"><i class="fa-solid fa-star"></i> ${score}/10</span>
                        </div>
                    </div>
                    ${optionalTitleHtml}
                </div>
            `;
        }
    } else if (post.title) {
        headerBlockHtml = `<h3 class="font-heading font-bold text-sm text-rose-900 dark:text-rose-400">${post.title}</h3>`;
    }

    let editButtonHtml = '';
    if (post.author === currentUsername) {
        editButtonHtml = `<button onclick="enableEditMuralPost('${post.id}')" class="text-xs font-mono text-stone-500 hover:text-rose-800 dark:hover:text-rose-400 transition ml-auto mr-3"><i class="fa-solid fa-pen mr-1"></i>Editar</button>`;
    }

    modal.innerHTML = `
        <div class="bg-stone-50 dark:bg-stone-900 journal-border rounded-none max-w-xl w-full p-5 space-y-3 text-left relative shadow-2xl draggable-modal-content flex flex-col">
            <div id="muralPostHeader" class="modal-header-drag flex items-center justify-between border-b border-stone-300 dark:border-stone-800 pb-2 flex-shrink-0">
                <span class="text-xs font-mono text-stone-500 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-grip-lines text-stone-400"></i> Detalle de debate</span>
                <button onclick="document.getElementById('muralPostModal').classList.add('hidden')" class="text-stone-400 hover:text-stone-800 dark:hover:text-white text-lg p-1 transition"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div class="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2 flex-shrink-0">
                <div class="flex items-center space-x-2.5 cursor-pointer hover:opacity-80 transition" onclick="openUserProfileModal('${post.author}', '${post.avatarSeed || post.author}', '${post.role || 'Crítico'}')">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(post.avatarSeed || post.author)}" class="w-8 h-8 rounded-full journal-border bg-stone-300">
                    <div>
                        <h4 class="font-heading font-bold text-xs hover:underline">${post.author}</h4>
                        <span class="text-[9px] font-mono text-stone-500 uppercase">${post.role || 'Crítico'}</span>
                    </div>
                </div>
                ${editButtonHtml}
                <span class="text-xs font-mono text-stone-400">${post.date}</span>
            </div>

            <div class="space-y-2 flex-shrink-0">
                ${headerBlockHtml}
                <p class="font-serif text-xs text-stone-700 dark:text-stone-300 leading-relaxed italic bg-stone-100 dark:bg-stone-950 p-2.5 journal-border">"${post.content}"</p>
            </div>

            <div class="flex items-center space-x-3 text-xs font-mono flex-shrink-0">
                <button onclick="reactToMuralPost('${post.id}', 'agree')" class="px-2.5 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-emerald-700/25 text-stone-700 dark:text-stone-300 journal-border transition flex items-center space-x-1.5 cursor-pointer ${agreeActive}">
                    <i class="fa-solid fa-thumbs-up text-emerald-600"></i>
                    <span>Acuerdo (${reactions.agree || 0})</span>
                </button>
                <button onclick="reactToMuralPost('${post.id}', 'disagree')" class="px-2.5 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-rose-700/25 text-stone-700 dark:text-stone-300 journal-border transition flex items-center space-x-1.5 cursor-pointer ${disagreeActive}">
                    <i class="fa-solid fa-thumbs-down text-rose-600"></i>
                    <span>Discrepo (${reactions.disagree || 0})</span>
                </button>
            </div>

            <div class="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800 flex-grow flex flex-col min-h-0">
                <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 flex-shrink-0"><i class="fa-solid fa-comments mr-1.5 text-rose-800"></i>Debate y comentarios (${comments.length})</h4>
                
                <div id="muralCommentsList_${post.id}" class="space-y-2 flex-grow overflow-y-auto custom-scrollbar pr-1 min-h-[80px]">
                    ${commentsTreeHtml}
                </div>

                <div class="space-y-1 pt-2 flex-shrink-0">
                    <div id="replyIndicator_${post.id}" class="text-[11px] font-mono text-stone-500 hidden"></div>
                    <div class="flex items-center space-x-2 relative">
                        <input type="text" id="newCommentInput_${postId}" placeholder="Añadir un apunte al debate..." class="flex-grow bg-stone-100 dark:bg-stone-950 journal-border px-3 py-1.5 text-xs font-serif focus:outline-none focus:border-rose-800" onkeydown="if(event.key === 'Enter') submitMuralComment('${post.id}')">
                        <button type="button" id="emojiBtn_newCommentInput_${postId}" onclick="toggleEmojiPicker('newCommentInput_${postId}')" class="px-2 py-1.5 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-700 dark:text-stone-300 journal-border text-xs transition" title="Añadir Emoji">🎬</button>
                        <button onclick="submitMuralComment('${post.id}')" class="px-3.5 py-1.5 bg-rose-900 hover:bg-rose-800 text-stone-100 font-mono text-xs journal-border transition uppercase">Comentar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    makeModalDraggable('muralPostModal', 'muralPostHeader');
    modal.classList.remove('hidden');
}

function submitMuralComment(postId) {
    const input = document.getElementById(`newCommentInput_${postId}`);
    if (!input || !input.value.trim()) return;

    let textVal = input.value.trim();
    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    let post = savedMural.find(p => p.id === postId);

    if (!post) {
        const allPosts = getCommunityAndUserPosts();
        post = allPosts.find(p => p.id === postId);
        if (post) {
            savedMural.push(JSON.parse(JSON.stringify(post)));
            post = savedMural[savedMural.length - 1];
        }
    }

    if (post) {
        if (!post.comments) post.comments = [];
        const targetObj = replyingTargetMap[postId];
        const parentId = targetObj ? targetObj.commentId : null;
        const replyToAuthor = targetObj ? targetObj.author : null;

        if (replyToAuthor && !textVal.startsWith(`@${replyToAuthor}`)) {
            textVal = `@${replyToAuthor} ${textVal}`;
        }

        const newComment = {
            id: 'c_' + Date.now() + Math.random().toString(36).substring(2, 7),
            parentId: parentId,
            replyToAuthor: replyToAuthor,
            author: currentUsername,
            avatarSeed: currentUsername,
            text: textVal,
            date: "Hace un momento",
            reactions: { agree: 0, disagree: 0 },
            userVotes: {}
        };

        post.comments.push(newComment);
        localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));

        clearReplyTarget(postId);
        input.value = '';
        openMuralPostModal(postId);
        renderMuralFeed();
    }
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
                <h4 class="font-heading font-bold text-sm text-stone-900 dark:text-stone-100 uppercase tracking-wider">${customTitle}</h4>
                <p class="font-serif text-xs text-stone-600 dark:text-stone-400">${customText}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 font-mono text-xs">
                <button id="cancelConfirmBtn" class="py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 journal-border transition uppercase tracking-wider">
                    Cancelar
                </button>
                <button id="acceptConfirmBtn" class="py-2 bg-rose-900 hover:bg-rose-800 text-stone-100 journal-border transition uppercase tracking-wider font-bold">
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
    }, "Eliminar cuaderno", `¿Estás seguro de que deseas eliminar el cuaderno "${listName}"? Se perderán todas las obras guardadas en él.`);
}

function confirmRemoveMovieFromList(listIndex, movieId) {
    showDeleteConfirmationModal(() => {
        customLists[listIndex].movies = customLists[listIndex].movies.filter(m => m.id !== movieId);
        saveAndRenderCustomLists();
        setTimeout(() => mantenerAcordeonAbierto(listIndex), 50);
    }, "Quitar obra", "¿Estás seguro de que deseas quitar esta película del cuaderno?");
}

function deleteMuralComment(postId, commentId) {
    showDeleteConfirmationModal(() => {
        let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
        let post = savedMural.find(p => p.id === postId);

        if (!post) {
            const allPosts = getCommunityAndUserPosts();
            const basePost = allPosts.find(p => p.id === postId);
            if (basePost) {
                post = JSON.parse(JSON.stringify(basePost));
                savedMural.push(post);
            }
        }

        if (post && post.comments) {
            post.comments = post.comments.filter(c => c.id !== commentId && c.parentId !== commentId);
            localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));
            openMuralPostModal(postId);
            renderMuralFeed();
        }
    });
}

function enableEditMuralPost(postId) {
    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    let post = savedMural.find(p => p.id === postId);

    if (!post) {
        const allPosts = getCommunityAndUserPosts();
        const basePost = allPosts.find(p => p.id === postId);
        if (basePost) {
            post = JSON.parse(JSON.stringify(basePost));
            savedMural.push(post);
        }
    }

    if (!post) return;

    const modalContentArea = document.querySelector('#muralPostModal .space-y-3');
    if (!modalContentArea) return;

    const currentText = post.content || '';
    const currentReviewTitle = post.reviewTitle || '';

    modalContentArea.innerHTML = `
        <div class="space-y-3 bg-stone-100 dark:bg-stone-950 p-3 journal-border">
            <span class="text-[10px] font-mono uppercase tracking-wider text-rose-800 dark:text-rose-400 font-bold">Editando apunte / reseña</span>
            
            <div class="space-y-1">
                <label class="text-[10px] font-mono text-stone-500 uppercase">Título del apunte</label>
                <input type="text" id="editPostTitleInput_${postId}" value="${currentReviewTitle}" class="w-full bg-stone-50 dark:bg-stone-900 journal-border px-2 py-1.5 text-xs font-heading font-bold focus:outline-none focus:border-rose-800">
            </div>

            <div class="space-y-1 relative">
                <label class="text-[10px] font-mono text-stone-500 uppercase">Contenido</label>
                <textarea id="editPostContentInput_${postId}" rows="3" class="w-full bg-stone-50 dark:bg-stone-900 journal-border p-2 text-xs font-serif focus:outline-none focus:border-rose-800">${currentText}</textarea>
            </div>

            <div class="flex items-center justify-end space-x-2 pt-1 font-mono text-xs">
                <button onclick="openMuralPostModal('${postId}')" class="px-3 py-1 bg-stone-300 dark:bg-stone-800 text-stone-700 dark:text-stone-300 journal-border transition">Cancelar</button>
                <button onclick="saveEditedMuralPost('${postId}')" class="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-stone-100 journal-border transition font-bold">Guardar cambios</button>
            </div>
        </div>
    `;
}

function saveEditedMuralPost(postId) {
    const titleInput = document.getElementById(`editPostTitleInput_${postId}`);
    const contentInput = document.getElementById(`editPostContentInput_${postId}`);
    if (!contentInput) return;

    const newContent = contentInput.value.trim();
    const newTitle = titleInput ? titleInput.value.trim() : '';

    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    let post = savedMural.find(p => p.id === postId);

    if (!post) {
        const allPosts = getCommunityAndUserPosts();
        const basePost = allPosts.find(p => p.id === postId);
        if (basePost) {
            post = JSON.parse(JSON.stringify(basePost));
            savedMural.push(post);
        }
    }

    if (post) {
        post.content = newContent;
        post.reviewTitle = newTitle;
        post.date = "Editado recientemente";

        localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));

        openMuralPostModal(postId);
        renderMuralFeed();
    }
}

function enableEditComment(postId, commentId) {
    const textEl = document.getElementById(`commentText_${commentId}`);
    if (!textEl) return;
    const currentText = textEl.innerText;

    textEl.innerHTML = `
        <div class="flex items-center space-x-2 pt-1 relative">
            <input type="text" id="editCommentInput_${commentId}" value="${currentText}" class="flex-grow bg-stone-50 dark:bg-stone-950 journal-border px-2 py-1 text-xs font-serif focus:outline-none focus:border-rose-800" onkeydown="if(event.key==='Enter') saveEditedComment('${postId}', '${commentId}')">
            <button type="button" id="emojiBtn_editCommentInput_${commentId}" onclick="toggleEmojiPicker('editCommentInput_${commentId}')" class="px-2 py-1 bg-stone-200 dark:bg-stone-800 text-xs journal-border">🎬</button>
            <button onclick="saveEditedComment('${postId}', '${commentId}')" class="px-2.5 py-1 bg-stone-800 text-stone-100 text-[10px] font-mono journal-border">Guardar</button>
        </div>
    `;
}

function saveEditedComment(postId, commentId) {
    const input = document.getElementById(`editCommentInput_${commentId}`);
    if (!input || !input.value.trim()) return;
    const newText = input.value.trim();

    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    let post = savedMural.find(p => p.id === postId);

    if (!post) {
        const allPosts = getCommunityAndUserPosts();
        post = allPosts.find(p => p.id === postId);
        if (post) {
            savedMural.push(JSON.parse(JSON.stringify(post)));
            post = savedMural[savedMural.length - 1];
        }
    }

    if (post && post.comments) {
        const comment = post.comments.find(c => c.id === commentId);
        if (comment) {
            comment.text = newText;
            comment.date = "Editado recientemente";
            localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));
            openMuralPostModal(postId);
            renderMuralFeed();
        }
    }
}

function reactToMuralPost(postId, type) {
    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    let post = savedMural.find(p => p.id === postId);

    if (!post) {
        const allPosts = getCommunityAndUserPosts();
        post = allPosts.find(p => p.id === postId);
        if (post) {
            savedMural.push(JSON.parse(JSON.stringify(post)));
            post = savedMural[savedMural.length - 1];
        }
    }

    if (post) {
        if (!post.reactions) post.reactions = { agree: 0, disagree: 0 };
        if (!post.userVotes) post.userVotes = {};

        const currentVote = post.userVotes[currentUsername];

        if (currentVote === type) {
            post.reactions[type] = Math.max(0, (post.reactions[type] || 0) - 1);
            post.userVotes[currentUsername] = null;
        } else {
            if (currentVote) {
                post.reactions[currentVote] = Math.max(0, (post.reactions[currentVote] || 0) - 1);
            }
            post.reactions[type] = (post.reactions[type] || 0) + 1;
            post.userVotes[currentUsername] = type;
        }

        localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));

        const modal = document.getElementById('muralPostModal');
        if (modal && !modal.classList.contains('hidden')) {
            openMuralPostModal(postId);
        }
        renderMuralFeed();
    }
}

function reactToComment(postId, commentId, type) {
    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    let post = savedMural.find(p => p.id === postId);

    if (!post) {
        const allPosts = getCommunityAndUserPosts();
        post = allPosts.find(p => p.id === postId);
        if (post) {
            savedMural.push(JSON.parse(JSON.stringify(post)));
            post = savedMural[savedMural.length - 1];
        }
    }

    if (post && post.comments) {
        const comment = post.comments.find(c => c.id === commentId);
        if (comment) {
            if (!comment.reactions) comment.reactions = { agree: 0, disagree: 0 };
            if (!comment.userVotes) comment.userVotes = {};

            const currentVote = comment.userVotes[currentUsername];

            if (currentVote === type) {
                comment.reactions[type] = Math.max(0, (comment.reactions[type] || 0) - 1);
                comment.userVotes[currentUsername] = null;
            } else {
                if (currentVote) {
                    comment.reactions[currentVote] = Math.max(0, (comment.reactions[currentVote] || 0) - 1);
                }
                comment.reactions[type] = (comment.reactions[type] || 0) + 1;
                comment.userVotes[currentUsername] = type;
            }

            localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));
            openMuralPostModal(postId);
        }
    }
}

function getCommunityAndUserPosts() {
    let userPublicPosts = [];
    const savedPersonal = JSON.parse(localStorage.getItem('cine_personal_reviews') || '{}');
    Object.keys(savedPersonal).forEach(movieId => {
        const item = savedPersonal[movieId];
        if (item && item.isPublic && item.review) {
            userPublicPosts.push({
                id: 'user_' + movieId,
                author: currentUsername,
                avatarSeed: currentUsername,
                role: "Crítico Principal / Editor",
                type: "review",
                tmdbMovieId: parseInt(movieId),
                movieObj: item.movie,
                rating: item.rating,
                reviewTitle: item.reviewTitle || '',
                title: '',
                content: item.review,
                date: "Reciente",
                reactions: { agree: 0, disagree: 0 },
                userVotes: {},
                comments: []
            });
        }
    });

    const communityPosts = [
        {
            id: 'comm_2',
            author: "Martín_Cine",
            avatarSeed: "Martin",
            role: "Crítico Invitado/a",
            type: "discussion",
            tmdbMovieId: null,
            title: "¿El cine de autor está perdiendo espacio en cartelera?",
            content: "Abro debate: cada vez cuesta más encontrar películas independientes en salas tradicionales. ¿Qué opinan? 🍿",
            date: "Oct 2026",
            reactions: { agree: 8, disagree: 1 },
            userVotes: {},
            comments: [
                { id: 'comm_c1', parentId: null, author: "Sofía_Film", avatarSeed: "Sofia", text: "Es totalmente cierto, las salas grandes priorizan franquicias. 🎬", date: "Ayer", reactions: { agree: 3, disagree: 0 }, userVotes: {} }
            ]
        }
    ];

    const customSaved = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    const map = new Map();

    [...communityPosts, ...userPublicPosts].forEach(p => map.set(p.id, p));

    customSaved.forEach(p => {
        if (map.has(p.id)) {
            const existing = map.get(p.id);
            map.set(p.id, { ...existing, ...p });
        } else {
            map.set(p.id, p);
        }
    });

    return Array.from(map.values());
}

function getAvatarUrl() {
    if (currentAvatarCustomUrl) return currentAvatarCustomUrl;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentAvatarSeed)}`;
}

function saveUserBioFromDrawer(val) {
    currentUserBio = val.trim();
    localStorage.setItem('cine_user_bio', currentUserBio);
}

function updateProfileDrawerStats() {
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

    const sWatched = document.getElementById('statWatchedCount');
    const sBitacora = document.getElementById('statBitacoraCount');
    const sLists = document.getElementById('statListsCount');
    if (sWatched) sWatched.innerText = watchedMovies.length;
    if (sBitacora) sBitacora.innerText = Object.keys(personalReviews).length;
    if (sLists) sLists.innerText = customLists.length;
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
    localStorage.setItem('cine_avatar_seed', currentAvatarSeed);
    updateProfileDrawerStats();
    closeAvatarWordModal();
}

window.onload = async () => {
    const initialIds = [872585, 98];
    moviesList = [];
    for (const id of initialIds) {
        const movie = await fetchDualLanguageMovie(`/movie/${id}`);
        if (movie) moviesList.push(movie);
    }

    resetAndFetchFilteredMovies();
    loadOscarMovies();
    renderCustomLists();
    updateProfileDrawerStats();

    switchMainTab(defaultMainTab);
    renderMuralFeed('all');

    makeModalDraggable('detailModal', 'detailModalHeader');
    makeModalDraggable('smartPublishModal', 'smartPublishHeader');
    makeModalDraggable('winnerModal', 'winnerModalHeader');
    makeModalDraggable('settingsModal', 'settingsHeader');
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
            votes: dataOverview.vote_count > 1000 ? (dataOverview.vote_count / 1000).toFixed(0) + 'k' : dataOverview.vote_count,
            poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/150',
            overview: dataOverview.overview || 'Sin descripción disponible.',
            year: dataOverview.release_date ? dataOverview.release_date.split('-')[0] : 'N/A'
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

async function fetchMultipleFilteredPages() {
    const genre = document.getElementById('genreSelect').value;
    const minRating = parseFloat(document.getElementById('minRatingInput').value);
    const maxRating = parseFloat(document.getElementById('maxRatingInput').value);
    const baseSortBy = document.getElementById('sortBySelect').value;
    const sortBy = `${baseSortBy}.${sortDirection}`;
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
                    votes: mEs.vote_count > 1000 ? (mEs.vote_count / 1000).toFixed(0) + 'k' : (mEs.vote_count || 0),
                    poster: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : 'https://via.placeholder.com/150',
                    overview: mEs.overview || 'Sin descripción disponible.',
                    year: mEs.release_date ? mEs.release_date.split('-')[0] : 'N/A'
                };
            });
            fetchedResults = [...fetchedResults, ...mapped];
        }
    });

    renderResultsGrid();

    const countIndicator = document.getElementById('catalogCountIndicator');
    if (countIndicator) {
        countIndicator.innerText = `${fetchedResults.length} obras`;
    }
}

function renderResultsGrid() {
    const container = document.getElementById('resultsGrid');
    if (!container) return;
    container.innerHTML = '';

    fetchedResults.forEach(movie => {
        const isWatched = watchedMovies.includes(movie.id);
        const pReview = personalReviews[movie.id];
        const personalRating = pReview && pReview.rating ? pReview.rating : null;

        const tmdbBadgeHtml = `<span class="bg-stone-900/85 backdrop-blur-md text-stone-100 px-1.5 py-0.5 text-[10px] font-mono journal-border shadow-md flex items-center space-x-1"><i class="fa-solid fa-star text-amber-500"></i><span>${movie.rating}</span></span>`;
        const personalBadgeHtml = personalRating !== null
            ? `<span class="bg-rose-900/90 backdrop-blur-md text-stone-100 px-1.5 py-0.5 text-[10px] font-mono journal-border shadow-md flex items-center space-x-1" title="Tu nota personal"><i class="fa-solid fa-feather text-amber-300"></i><span>${personalRating.toFixed(1)} (Tú)</span></span>`
            : '';

        const subTitleHtml = (movie.subtitle && movie.subtitle.trim() !== '')
            ? `<span class="block text-[10px] font-mono text-stone-500 truncate">${movie.subtitle}</span>`
            : '';

        const card = document.createElement('div');
        card.className = `bg-stone-50 dark:bg-stone-900 journal-border p-2.5 flex flex-col justify-between transition group relative cursor-pointer shadow-sm ${isWatched ? 'opacity-60' : 'hover:border-rose-900'}`;
        card.onclick = (e) => { if (!e.target.closest('button')) openDetailModal(movie, "Reseña de catálogo"); };

        card.innerHTML = `
            <div class="relative aspect-[2/3] w-full overflow-hidden journal-border bg-stone-200 dark:bg-stone-950 mb-2">
                <img src="${movie.poster}" onerror="this.src='https://via.placeholder.com/150'" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                
                <div class="absolute top-2 left-2 z-10">
                    ${tmdbBadgeHtml}
                </div>

                <div class="absolute bottom-2 left-2 z-10">
                    ${personalBadgeHtml}
                </div>

                <button onclick="event.stopPropagation(); toggleWatchedStatus(${movie.id}); renderResultsGrid();" 
                    class="absolute top-2 right-2 z-10 p-1.5 bg-stone-900/80 hover:bg-rose-900 text-stone-100 journal-border text-xs transition shadow-md cursor-pointer ${isWatched ? '!bg-emerald-800' : ''}" 
                    title="${isWatched ? 'Marcar como no vista' : 'Marcar como vista'}">
                    <i class="fa-${isWatched ? 'solid' : 'regular'} fa-eye"></i>
                </button>
            </div>
            <div class="space-y-1">
                <h5 class="text-xs font-serif font-semibold truncate group-hover:text-rose-800 dark:group-hover:text-rose-400 transition">${movie.title}</h5>
                ${subTitleHtml}
                <div class="flex items-center justify-between pt-1 border-t border-stone-200 dark:border-stone-800 text-[10px] font-mono text-stone-400">
                    <span>${movie.year || 'N/A'}</span>
                    <span>${movie.votes} votos</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
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
    let filteredDB = OSCAR_DATABASE.filter(m => oscarMode === 'WINNERS' ? m.isWinner : true);
    const results = await Promise.all(filteredDB.slice(0, 10).map(async (item) => {
        const movie = await fetchDualLanguageMovie(`/movie/${item.tmdbId}`);
        if (movie) { movie.oscarYear = item.oscarYear; movie.isWinner = item.isWinner; return movie; }
        return null;
    }));
    currentOscarList = results.filter(m => m !== null);
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
        const encoded = encodeURIComponent(query.trim());
        const data = await fetchFromTMDb(`/search/movie?query=${encoded}&language=${currentLang}`);

        if (spinner) spinner.classList.add('hidden');

        if (data && data.results && data.results.length > 0) {
            if (dropdown) {
                dropdown.innerHTML = '';
                data.results.slice(0, 5).forEach(m => {
                    const poster = m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : 'https://via.placeholder.com/92';
                    const year = m.release_date ? m.release_date.split('-')[0] : 'N/A';
                    const title = m.title || m.original_title;

                    const item = document.createElement('div');
                    item.className = "flex items-center space-x-3 p-2 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer transition border-b border-stone-200 dark:border-stone-800 last:border-b-0";
                    item.innerHTML = `
                        <img src="${poster}" class="w-8 h-12 object-cover journal-border flex-shrink-0">
                        <div class="overflow-hidden">
                            <h5 class="text-xs font-serif font-bold truncate">${title} (${year})</h5>
                            <span class="text-[10px] font-mono text-stone-500"><i class="fa-solid fa-star text-amber-500"></i> ${m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}</span>
                        </div>
                    `;
                    item.onclick = () => {
                        dropdown.classList.add('hidden');
                        document.getElementById('manualMovieInput').value = title;
                        const movieObj = {
                            id: m.id,
                            title: title,
                            subtitle: m.original_title !== title ? m.original_title : '',
                            rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
                            votes: m.vote_count > 1000 ? (m.vote_count / 1000).toFixed(0) + 'k' : (m.vote_count || 0),
                            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/150',
                            overview: m.overview || 'Sin descripción disponible.'
                        };
                        openDetailModal(movieObj, "Búsqueda directa");
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

let currentPublishMode = 'review';
let modalAutocompleteTimer = null;
let cachedSelectedMovieObj = null;

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

function openRedactionChoice(mode) {
    resetModalPosition('smartPublishModal');
    currentPublishMode = mode;
    const modal = document.getElementById('smartPublishModal');
    const titleEl = document.getElementById('smartModalTitle');
    const movieContainer = document.getElementById('movieSelectContainer');
    const ratingContainer = document.getElementById('ratingContainer');
    const titleLabel = document.getElementById('titleFieldLabel');
    const titleInput = document.getElementById('smartPostTitle');

    const form = document.getElementById('smartPublishForm');
    if (form) form.reset();

    const selectedIdInput = document.getElementById('selectedTmdbMovieId');
    if (selectedIdInput) selectedIdInput.value = '';
    cachedSelectedMovieObj = null;

    if (mode === 'review') {
        if (titleEl) titleEl.innerText = "✍️ Redactar reseña cinematográfica";
        if (movieContainer) movieContainer.classList.remove('hidden');
        if (ratingContainer) ratingContainer.classList.remove('hidden');
        if (titleLabel) titleLabel.innerText = "Titular de la reseña (Opcional)";
        if (titleInput) titleInput.removeAttribute('required');
    } else {
        if (titleEl) titleEl.innerText = "💬 Abrir debate en el muro";
        if (movieContainer) movieContainer.classList.add('hidden');
        if (ratingContainer) ratingContainer.classList.add('hidden');
        if (titleLabel) titleLabel.innerText = "Pregunta o tema del debate";
        if (titleInput) titleInput.setAttribute('required', 'true');
    }

    if (modal) modal.classList.remove('hidden');
}

function closeSmartPublishModal() {
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
        const encoded = encodeURIComponent(query.trim());
        const data = await fetchFromTMDb(`/search/movie?query=${encoded}&language=${currentLang}`);

        if (data && data.results && data.results.length > 0) {
            if (dropdown) {
                dropdown.innerHTML = '';
                data.results.slice(0, 5).forEach(m => {
                    const poster = m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : 'https://via.placeholder.com/92';
                    const year = m.release_date ? m.release_date.split('-')[0] : 'N/A';
                    const title = m.title || m.original_title;

                    const item = document.createElement('div');
                    item.className = "flex items-center space-x-2 p-2 hover:bg-stone-200 dark:hover:bg-stone-800 cursor-pointer transition border-b border-stone-200 dark:border-stone-800 last:border-b-0 text-xs";
                    item.innerHTML = `
                        <img src="${poster}" class="w-7 h-10 object-cover journal-border flex-shrink-0">
                        <div>
                            <span class="font-serif font-bold">${title} (${year})</span>
                        </div>
                    `;
                    item.onclick = () => {
                        document.getElementById('modalMovieSearchInput').value = `${title} (${year})`;
                        document.getElementById('selectedTmdbMovieId').value = m.id;
                        cachedSelectedMovieObj = {
                            id: m.id,
                            title: title,
                            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/150',
                            rating: m.vote_average ? m.vote_average.toFixed(1) : '8.0',
                            overview: m.overview || 'Sin descripción disponible.'
                        };
                        dropdown.classList.add('hidden');
                    };
                    dropdown.appendChild(item);
                });
                dropdown.classList.remove('hidden');
            }
        } else {
            if (dropdown) {
                dropdown.innerHTML = `<div class="p-2 text-xs font-serif italic text-stone-400 text-center">No se encontró la película.</div>`;
                dropdown.classList.remove('hidden');
            }
        }
    }, 400);
}

function handleSmartPublishSubmit(e) {
    e.preventDefault();

    const titleVal = document.getElementById('smartPostTitle').value.trim();
    const contentVal = document.getElementById('smartPostContent').value.trim();
    const ratingVal = parseFloat(document.getElementById('smartPostRating').value);
    const movieIdVal = document.getElementById('selectedTmdbMovieId').value;

    let newPost = {
        id: 'post_' + Date.now(),
        author: currentUsername,
        avatarSeed: currentUsername,
        role: "Crítico principal / Editor",
        type: currentPublishMode,
        date: "Hace un momento",
        reactions: { agree: 0, disagree: 0 },
        userVotes: {},
        comments: []
    };

    if (currentPublishMode === 'review') {
        if (!movieIdVal || !cachedSelectedMovieObj) {
            alert("Por favor selecciona una película del buscador para tu reseña.");
            return;
        }
        newPost.tmdbMovieId = parseInt(movieIdVal);
        newPost.movieObj = cachedSelectedMovieObj;
        newPost.reviewTitle = titleVal;
        newPost.rating = isNaN(ratingVal) ? null : ratingVal;
        newPost.content = contentVal;
        newPost.title = '';
    } else {
        newPost.title = titleVal;
        newPost.content = contentVal;
        newPost.tmdbMovieId = null;
    }

    let savedMural = JSON.parse(localStorage.getItem('cine_diario_mural_posts') || '[]');
    savedMural.unshift(newPost);
    localStorage.setItem('cine_diario_mural_posts', JSON.stringify(savedMural));

    closeSmartPublishModal();
    renderMuralFeed('all');
}