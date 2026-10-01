document.addEventListener('DOMContentLoaded', () => {
    const navSwitch = document.getElementById('nav-switch');
    const menuButtons = document.querySelectorAll('.game-menu .menu-button');
    const buttonA = document.getElementById('button-A');
    const buttonB = document.getElementById('button-B');
    const gameContainer = document.querySelector('.game-container');
    const ingredientDisplayArea = document.getElementById('ingredient-display-area');
    const knife = document.getElementById('knife');
    const cutsContainer = document.getElementById('cuts-container');
    const contextText = document.getElementById('context-text');
    const scoreText = document.getElementById('score-text');
    const messageText = document.getElementById('message-text');
    const gameInfoWrapper = document.getElementById('game-info-wrapper');
    const videoPlayerContainer = document.getElementById('video-player-container');
    const videoElement = document.getElementById('my-video');
    const centerPlayIcon = document.getElementById('center-play-icon');
    const volumeControl = document.getElementById('volume-control');
    const fullscreenControl = document.getElementById('fullscreen-control');
    const volumeIcon = document.getElementById('volume-icon');
    const galleryContainer = document.getElementById('gallery-container');
    const darkScreen = document.getElementById('dark-screen');
    const startupLine = document.getElementById('startup-line');
    const startupLogo = document.getElementById('startup-logo');
    const videoOverlay = document.getElementById('video-overlay');
    const slicerPreview = document.getElementById('slicer-preview');
    const snakePreview = document.getElementById('snake-preview');
    const emplatadoPreview = document.getElementById('emplatado-preview');
    const equilibrioPreview = document.getElementById('equilibrio-preview');
    const menuButtonsContainer = document.querySelector('.game-menu .menu-buttons-container');
    const menuScrollHintUp = document.querySelector('.menu-scroll-hint.up');
    const menuScrollHintDown = document.querySelector('.menu-scroll-hint.down');
    let soundEnabled = localStorage.getItem('pe-sound') !== '0';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ========== WEB AUDIO API SOUND SYSTEM ==========
    // This provides much lower latency on mobile devices
    let audioContext = null;
    let audioBuffers = {};
    let audioUnlocked = false;
    let currentChopSound = 1;

    // Sound URLs - map to the audio element sources
    const soundUrls = {
        button: 'https://cdn.freesound.org/previews/378/378085_6260145-lq.mp3',
        startup: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111742/console-starts_bczuzf.mp3',
        chop1: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111743/chop-1_qsg8od.mp4',
        chop2: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111744/chop-2_ine0k7.mp4',
        sliceResult: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111742/slice-result_m614lq.mp3',
        gameStart: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111742/game-start-screen_qmzjil.mp3',
        snakeLose: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111742/snake-game-lose_kxunmt.mp3',
        snakeMove: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111743/snake-move_tfdbj1.mp3',
        snakeDeliver: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763112291/deliver-to-table-snake_ljcmdr.mp3',
        buttonPress: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111743/button-press_lbscvk.mp3',
        exitGame: 'https://res.cloudinary.com/dn53emznt/video/upload/v1763111743/exit-game_a9ehju.mp3'
    };

    // For looping sounds, we need special handling
    let carryingLoopSource = null;
    let carryingLoopGain = null;

    // Initialize Web Audio API
    function initAudioContext() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Pre-load all sounds
            preloadAllSounds();
        } catch (e) {
            console.log('Web Audio API not supported:', e);
        }
    }

    // Unlock audio on first user interaction (required for mobile)
    function unlockAudio() {
        if (audioUnlocked) return;

        initAudioContext();

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                audioUnlocked = true;
                console.log('Audio context unlocked');
            });
        } else {
            audioUnlocked = true;
        }
    }

    // Load a single sound into buffer
    async function loadSound(name, url) {
        if (!audioContext) return;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBuffers[name] = audioBuffer;
        } catch (e) {
            console.log(`Failed to load sound ${name}:`, e);
        }
    }

    // Pre-load all sounds
    function preloadAllSounds() {
        Object.entries(soundUrls).forEach(([name, url]) => {
            loadSound(name, url);
        });
        // Also load the carrying loop
        loadSound('snakeCarrying', 'https://res.cloudinary.com/dn53emznt/video/upload/v1763112337/loop-until-deliver_j2skcy.mp3');
    }

    // Play a sound with Web Audio API (instant playback)
    function playSound(name, volume = 1.0) {
        if (!soundEnabled) return;
        if (!audioContext || !audioBuffers[name]) {
            // Fallback to HTML audio elements if Web Audio not ready
            playFallbackSound(name);
            return;
        }

        try {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[name];

            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start(0);
        } catch (e) {
            console.log(`Error playing sound ${name}:`, e);
        }
    }

    // Start looping sound
    function startLoopingSound(name, volume = 0.5) {
        if (!soundEnabled) return;
        if (!audioContext || !audioBuffers[name]) return;

        // Stop existing loop if any
        stopLoopingSound();

        try {
            carryingLoopSource = audioContext.createBufferSource();
            carryingLoopSource.buffer = audioBuffers[name];
            carryingLoopSource.loop = true;

            carryingLoopGain = audioContext.createGain();
            carryingLoopGain.gain.value = volume;

            carryingLoopSource.connect(carryingLoopGain);
            carryingLoopGain.connect(audioContext.destination);
            carryingLoopSource.start(0);
        } catch (e) {
            console.log('Error starting loop:', e);
        }
    }

    // Stop looping sound
    function stopLoopingSound() {
        if (carryingLoopSource) {
            try {
                carryingLoopSource.stop();
            } catch (e) {}
            carryingLoopSource = null;
        }
        carryingLoopGain = null;
    }

    // Fallback to HTML audio elements for browsers without Web Audio support
    const fallbackElements = {};
    function playFallbackSound(name) {
        const elementMap = {
            button: 'button-sound',
            startup: 'startup-sound',
            chop1: 'chop-sound-1',
            chop2: 'chop-sound-2',
            sliceResult: 'slice-result-sound',
            gameStart: 'game-start-screen-sound',
            snakeLose: 'snake-lose-sound',
            snakeMove: 'snake-move-sound',
            snakeDeliver: 'snake-deliver-sound',
            buttonPress: 'button-press-sound',
            exitGame: 'exit-game-sound'
        };

        const elementId = elementMap[name];
        if (!elementId) return;

        if (!fallbackElements[name]) {
            fallbackElements[name] = document.getElementById(elementId);
        }

        const el = fallbackElements[name];
        if (el) {
            el.currentTime = 0;
            el.play().catch(() => {});
        }
    }

    // Add unlock listeners to common interaction points
    ['touchstart', 'touchend', 'mousedown', 'click'].forEach(event => {
        document.addEventListener(event, unlockAudio, { once: false, passive: true });
    });

    // Initialize audio context early (will be suspended until user interaction)
    initAudioContext();

    // ========== SOUND HELPER FUNCTIONS ==========
    function playButtonSound() {
        playSound('button', 0.5);
    }

    function playButtonPressSound() {
        playSound('buttonPress', 0.6);
    }

    function playChopSound() {
        const soundName = currentChopSound === 1 ? 'chop1' : 'chop2';
        playSound(soundName, 0.7);
        currentChopSound = currentChopSound === 1 ? 2 : 1;
    }

    function playStartupSound() {
        playSound('startup', 0.8);
    }

    function playSliceResultSound() {
        playSound('sliceResult', 0.6);
    }

    function playGameStartSound() {
        playSound('gameStart', 0.6);
    }

    function playSnakeLoseSound() {
        playSound('snakeLose', 0.7);
    }

    function playSnakeMoveSound() {
        playSound('snakeMove', 0.4);
    }

    function playSnakeDeliverSound() {
        playSound('snakeDeliver', 0.7);
    }

    function playExitGameSound() {
        playSound('exitGame', 0.6);
    }

    function startSnakeCarryingLoop() {
        startLoopingSound('snakeCarrying', 0.3);
    }

    function stopSnakeCarryingLoop() {
        stopLoopingSound();
    }

    // Menu index constants
    const GALLERY_INDEX = 0;
    const VIDEO_INDEX = 1;
    const GAME1_INDEX = 2;
    const GAME2_INDEX = 3;
    const GAME3_INDEX = 4;    // EMPLATADO
    const GAME4_INDEX = 5;    // EQUILIBRIO
    const RESERVAR_INDEX = 6;
    const SETTINGS_INDEX = 7;
    const ENTROPY_INDEX = 8;
    const VIDEO_MENU_INDEX = VIDEO_INDEX; // Keep for compatibility

    let currentMenuIndex = GALLERY_INDEX;
    let gameActive = false;
    const KNIFE_SPEED_BASE = 1.8;
    let currentKnifeSpeed = KNIFE_SPEED_BASE;
    let knifePositionPx = 0;
    let knifeDirection = 1;
    let animationFrameId;
    let currentIngredient = null;
    let mainIngredientSvgElement = null;
    let slicesMade = [];
    let currentPassCount = 0;
    const MAX_PASSES = 3;
    let totalGameScore = 0;
    let currentIngredientIndex = 0;
    let gameLevel = 1;
    let roundOver = false;
    let lastBPressTime = 0;
    const DOUBLE_CLICK_B_TIMEOUT = 500;
    const VIDEO_FILE_PATH = "https://res.cloudinary.com/dn53emznt/video/upload/v1763080295/presunta-entropia_bgg2ln.mp4";

    // Gallery crossfade functionality
    let galleryImages = [];
    let currentGalleryIndex = 0;
    let galleryInterval = null;
    let galleryFirstChange = true;

    function flattenGalleryCollectionList() {
        if (!galleryContainer) return;

        // Find Webflow CMS Collection List items
        const dynItems = galleryContainer.querySelector('.w-dyn-items');
        if (!dynItems) return;

        // Get all collection items (direct children of .w-dyn-items)
        const items = Array.from(dynItems.children);

        // Move each item's content directly into gallery container
        items.forEach(item => {
            // Move all children of the collection item to the gallery
            while (item.firstChild) {
                const child = item.firstChild;
                galleryContainer.appendChild(child);
                // Add gallery-image class for styling if it's an element
                if (child.nodeType === 1) {
                    child.classList.add('gallery-image');
                }
            }
        });

        // Remove the empty CMS wrapper structure
        const cmsWrapper = galleryContainer.querySelector('.w-dyn-list')?.parentElement || galleryContainer.querySelector('.w-dyn-list');
        if (cmsWrapper && cmsWrapper !== galleryContainer) {
            cmsWrapper.remove();
        } else if (galleryContainer.querySelector('.w-dyn-list')) {
            galleryContainer.querySelector('.w-dyn-list').remove();
        }
    }

    function initGallery() {
        // First, flatten any CMS collection list items
        flattenGalleryCollectionList();

        // Now get all gallery images (works with both static and CMS)
        galleryImages = galleryContainer ? galleryContainer.querySelectorAll('.gallery-image') : [];

        // Make sure first image is active
        if (galleryImages.length > 0) {
            galleryImages.forEach((img, index) => {
                if (index === 0) {
                    img.classList.add('active');
                } else {
                    img.classList.remove('active');
                }
            });
        }

        // Setup click navigation (crossfade is started after page startup animation)
        if (galleryImages.length > 1) {
            setupGalleryClickNavigation();
        }
    }

    function nextGalleryImage() {
        if (galleryImages.length < 2) return;
        galleryImages[currentGalleryIndex].classList.remove('active');
        currentGalleryIndex = (currentGalleryIndex + 1) % galleryImages.length;
        galleryImages[currentGalleryIndex].classList.add('active');
    }

    function prevGalleryImage() {
        if (galleryImages.length < 2) return;
        galleryImages[currentGalleryIndex].classList.remove('active');
        currentGalleryIndex = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;
        galleryImages[currentGalleryIndex].classList.add('active');
    }

    function startGalleryCrossfade() {
        if (galleryInterval) clearInterval(galleryInterval);
        galleryFirstChange = true;

        // First change happens quickly (500ms), then regular interval
        setTimeout(() => {
            if (currentMenuIndex === GALLERY_INDEX && galleryFirstChange) {
                nextGalleryImage();
                galleryFirstChange = false;
            }
        }, 500);

        galleryInterval = setInterval(() => {
            if (currentMenuIndex === GALLERY_INDEX) {
                nextGalleryImage();
            }
        }, 3000); // Crossfade every 3 seconds after first quick change
    }

    function stopGalleryCrossfade() {
        if (galleryInterval) {
            clearInterval(galleryInterval);
            galleryInterval = null;
        }
    }

    function setupGalleryClickNavigation() {
        if (!galleryContainer) return;

        galleryContainer.addEventListener('click', (e) => {
            if (currentMenuIndex !== GALLERY_INDEX) return;

            const rect = galleryContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const containerWidth = rect.width;

            // Left half = previous, right half = next
            if (clickX < containerWidth / 2) {
                prevGalleryImage();
            } else {
                nextGalleryImage();
            }

            // Reset the interval timer after manual navigation
            if (galleryInterval) {
                clearInterval(galleryInterval);
                galleryInterval = setInterval(() => {
                    if (currentMenuIndex === GALLERY_INDEX) {
                        nextGalleryImage();
                    }
                }, 3000);
            }
        });
    }

    // Session guard: prevents two async game boots racing each other (menu
    // change or double press during the startup animation used to leave
    // gameActive stuck true with no game on screen — console soft-lock).
    let gameSessionToken = 0;
    let bootInProgress = false;

    // GAME 1: Slice Master variables
    const ALL_INGREDIENTS_DATA = [
        { name: "Tomate", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><path d="M50 23 Q62 16 73 24 Q87 34 85 53 Q88 72 73 84 Q60 94 47 88 Q30 94 18 80 Q8 67 14 50 Q10 34 25 25 Q37 17 50 23 Z" fill="#9b4933" stroke="#442b26" stroke-width="3"/><path d="M27 38 Q35 27 47 30 Q39 35 36 46 Q29 50 24 46 Q23 42 27 38 Z" fill="#e8d5c4" fill-opacity="0.35"/><path d="M49 26 L39 17 L48 18 Q48 9 53 5 Q57 12 55 19 L67 15 L61 25 L73 29 L58 31 L49 41 L45 30 L31 30 L41 24 Z" fill="#6b5d30"/></svg>`, context: "¡para un sándwich jugoso!", idealWidthMin: 25, idealWidthMax: 40, targetSlicesPerPass: 3 },
        { name: "Limón", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 140 80" preserveAspectRatio="xMidYMid meet"><path d="M13 40 Q22 34 27 24 Q42 7 71 10 Q102 8 116 26 Q121 35 131 39 Q121 46 116 55 Q99 72 70 69 Q40 72 25 54 Q20 46 13 40 Z" fill="#efa02e" stroke="#d1892a" stroke-width="3"/><path d="M34 31 Q48 17 70 18 Q51 23 42 39 Q33 43 30 38 Q30 35 34 31 Z" fill="#f3bc6c"/><circle cx="91" cy="24" r="2" fill="#d1892a"/><circle cx="106" cy="39" r="1.8" fill="#d1892a"/><circle cx="84" cy="56" r="1.5" fill="#d1892a"/></svg>`, context: "¡para aliñar el ceviche!", idealWidthMin: 20, idealWidthMax: 35, targetSlicesPerPass: 3 },
        { name: "Sandía", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet"><path d="M8 25 Q78 8 152 26 Q143 66 110 79 Q77 91 43 77 Q17 65 8 25 Z" fill="#6b5d30" stroke="#442b26" stroke-width="3"/><path d="M14 28 Q79 13 145 29 Q136 57 106 69 Q77 80 47 68 Q23 59 14 28 Z" fill="#e8d5c4"/><path d="M20 31 Q79 19 139 32 Q130 52 103 62 Q77 72 50 62 Q29 54 20 31 Z" fill="#9b4933"/><ellipse cx="47" cy="40" rx="3" ry="6" fill="#442b26"/><ellipse cx="69" cy="32" rx="3" ry="5" fill="#442b26"/><ellipse cx="88" cy="48" rx="3" ry="6" fill="#442b26"/><ellipse cx="111" cy="35" rx="3" ry="5" fill="#442b26"/><ellipse cx="119" cy="51" rx="2.5" ry="5" fill="#442b26"/></svg>`, context: "¡para el postre de verano!", idealWidthMin: 25, idealWidthMax: 40, targetSlicesPerPass: 3 },
        { name: "Chile", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 160 60" preserveAspectRatio="xMidYMid meet"><path d="M25 17 Q61 12 93 24 Q121 35 151 23 Q137 44 111 49 Q80 55 55 39 Q37 28 20 30 Q13 25 25 17 Z" fill="#9b4933" stroke="#442b26" stroke-width="3"/><path d="M48 30 Q79 30 104 41 Q122 44 139 34 Q122 50 102 47 Q73 44 48 30 Z" fill="#d1892a"/><path d="M24 18 Q17 10 8 12 Q14 18 13 26 Q19 31 26 28 Q22 23 24 18 Z" fill="#6b5d30"/><path d="M35 20 Q54 17 70 22 Q54 23 42 27 Q34 27 31 24 Z" fill="#f3bc6c" fill-opacity="0.35"/></svg>`, context: "¡para darle fuego al guiso!", idealWidthMin: 15, idealWidthMax: 25, targetSlicesPerPass: 4 },
        { name: "Ajo", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 100 110" preserveAspectRatio="xMidYMid meet"><path d="M48 25 Q47 14 53 5 Q59 17 57 29 Q68 27 75 37 Q88 47 86 67 Q85 88 68 98 Q51 107 31 99 Q14 91 13 70 Q10 51 25 38 Q34 28 48 25 Z" fill="#e8d5c4" stroke="#8b6914" stroke-width="3"/><path d="M31 43 Q23 62 29 86" fill="none" stroke="#8b6914" stroke-width="3" stroke-opacity="0.45"/><path d="M48 35 Q40 62 47 98" fill="none" stroke="#8b6914" stroke-width="3" stroke-opacity="0.45"/><path d="M65 40 Q76 61 67 91" fill="none" stroke="#8b6914" stroke-width="3" stroke-opacity="0.45"/><path d="M25 55 Q29 41 40 36 Q31 58 35 76 Q27 73 23 65 Z" fill="#f3bc6c" fill-opacity="0.35"/><line x1="31" y1="99" x2="27" y2="107" stroke="#8b6914" stroke-width="2"/><line x1="43" y1="102" x2="41" y2="109" stroke="#8b6914" stroke-width="2"/><line x1="56" y1="102" x2="58" y2="109" stroke="#8b6914" stroke-width="2"/><line x1="68" y1="98" x2="73" y2="106" stroke="#8b6914" stroke-width="2"/></svg>`, context: "¡para el sofrito de la abuela!", idealWidthMin: 30, idealWidthMax: 45, targetSlicesPerPass: 2 },
        { name: "Pescado", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 170 70" preserveAspectRatio="xMidYMid meet"><path d="M35 35 Q58 8 103 13 Q126 16 139 31 Q151 18 165 12 Q160 28 161 35 Q160 44 166 58 Q150 51 138 40 Q120 58 91 59 Q54 61 35 35 Z" fill="#f3bc6c" stroke="#d1892a" stroke-width="3"/><path d="M47 29 Q74 13 108 19 Q125 21 137 32 Q108 27 82 32 Q60 36 47 29 Z" fill="#d1892a"/><path d="M139 31 Q151 18 165 12 Q160 28 161 35 Q160 44 166 58 Q150 51 138 40 Z" fill="#efa02e"/><path d="M91 56 Q103 67 118 61 Q109 51 101 48 Z" fill="#efa02e"/><circle cx="55" cy="31" r="5" fill="#0d161d"/><circle cx="53.5" cy="29.5" r="1.5" fill="#e8d5c4"/><path d="M39 41 Q46 45 52 41" fill="none" stroke="#0d161d" stroke-width="2"/></svg>`, context: "¡para el ceviche fresco!", idealWidthMin: 20, idealWidthMax: 35, targetSlicesPerPass: 3 },
        { name: "Zanahoria", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 80 150" preserveAspectRatio="xMidYMid meet"><path d="M17 39 Q39 30 64 40 Q59 75 52 106 Q47 132 39 146 Q30 129 25 105 Q19 73 17 39 Z" fill="#efa02e" stroke="#d1892a" stroke-width="3"/><path d="M31 40 Q27 20 13 9 Q31 11 40 31 Q40 10 51 3 Q54 20 47 34 Q61 17 72 19 Q61 36 54 41 Z" fill="#6b5d30"/><line x1="24" y1="61" x2="45" y2="65" stroke="#d1892a" stroke-width="3"/><line x1="31" y1="83" x2="55" y2="79" stroke="#d1892a" stroke-width="3"/><line x1="31" y1="105" x2="47" y2="108" stroke="#d1892a" stroke-width="3"/><path d="M25 47 Q30 43 36 44 Q31 67 35 89 Q28 76 25 47 Z" fill="#f3bc6c" fill-opacity="0.35"/></svg>`, context: "¡para un snack crujiente!", idealWidthMin: 18, idealWidthMax: 30, targetSlicesPerPass: 4 },
        { name: "Berenjena", svgString: `<svg id="main-ingredient-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet"><path d="M50 34 Q72 27 85 48 Q98 69 88 101 Q79 130 52 136 Q26 136 14 113 Q1 87 12 61 Q23 38 50 34 Z" fill="#442b26" stroke="#3d2914" stroke-width="4"/><path d="M24 61 Q31 43 48 42 Q35 57 33 85 Q27 96 21 86 Q18 74 24 61 Z" fill="#9b4933"/><path d="M49 36 L31 29 L43 22 Q45 13 51 4 Q57 13 56 24 L72 18 L66 34 L82 38 L61 44 Z" fill="#6b5d30"/><path d="M26 56 Q31 47 39 44 Q31 59 29 72 Q23 70 26 56 Z" fill="#e8d5c4" fill-opacity="0.35"/></svg>`, context: "¡para asar mmm!", idealWidthMin: 30, idealWidthMax: 45, targetSlicesPerPass: 2 }
    ];
    let ingredientsQueue = [];

    // GAME 2: Restaurant Delivery Game variables
    const snakeCanvas = document.getElementById('snake-game-canvas');
    const snakeCtx = snakeCanvas ? snakeCanvas.getContext('2d') : null;
    const GRID_SIZE = 15; // Smaller grid for more space
    let snakeGameActive = false;
    let emplatadoActive = false;
    let equilibrioActive = false;
    let snakeAnimationId;
    let emplatadoAnimationId;
    let equilibrioAnimationId;
    let snake = [];
    let snakeDirection = 'right'; // 'up', 'down', 'left', 'right'
    let chefStation = { x: 0, y: 0 }; // Chef's kitchen station
    let currentPlate = null; // Current plate being carried (number)
    let tables = []; // Array of table objects { x, y, number }
    let availablePlate = null; // Plate waiting at chef station
    let snakeScore = 0;
    let snakeSpeed = 150; // milliseconds per move
    let lastSnakeMoveTime = 0;
    let gridWidth = 0;
    let gridHeight = 0;
    let deliveriesCompleted = 0;
    let isHoveringGameboy = false;

    // Red fruit / special mechanics variables
    let redFruit = null; // { x, y } position of red fruit when spawned
    let redSegmentCount = 0; // Count of red segments at tail
    let activePowerUp = null; // Current active power: 'speed', 'ghost', 'magnet'
    let powerUpTimer = 0; // Frames remaining for power-up
    let preSpeedPowerUpSpeed = 150; // Store speed before speed power-up
    const RED_COLOR = '#e63946'; // Bright red for visibility

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function updateMenuScrollHints() {
        if (!menuButtonsContainer) return;
        const canScrollUp = menuButtonsContainer.scrollTop > 1;
        const canScrollDown = menuButtonsContainer.scrollTop + menuButtonsContainer.clientHeight < menuButtonsContainer.scrollHeight - 1;
        if (menuScrollHintUp) menuScrollHintUp.classList.toggle('visible', canScrollUp);
        if (menuScrollHintDown) menuScrollHintDown.classList.toggle('visible', canScrollDown);
    }

    if (menuButtonsContainer) {
        menuButtonsContainer.addEventListener('scroll', updateMenuScrollHints, { passive: true });
    }

    function updateMenuSelectionDisplay() {
        menuButtons.forEach((button, index) => {
            button.classList.toggle('selected', index === currentMenuIndex);
        });

        if (menuButtonsContainer) {
            const selectedButton = menuButtons[currentMenuIndex];
            if (selectedButton) {
                const buttonTop = selectedButton.offsetTop;
                const buttonBottom = buttonTop + selectedButton.offsetHeight;
                const visibleTop = menuButtonsContainer.scrollTop;
                const visibleBottom = visibleTop + menuButtonsContainer.clientHeight;

                if (buttonTop < visibleTop) {
                    menuButtonsContainer.scrollTop = buttonTop;
                } else if (buttonBottom > visibleBottom) {
                    menuButtonsContainer.scrollTop = buttonBottom - menuButtonsContainer.clientHeight;
                }
            }
            updateMenuScrollHints();
        }

        // Any menu change invalidates a pending game boot
        gameSessionToken++;

        // Reset any active games when switching tabs
        if (gameActive || snakeGameActive || emplatadoActive || equilibrioActive) {
            // Play exit game sound
            playExitGameSound();
        }

        if (gameActive) {
            gameActive = false;
            roundOver = true;
            cancelAnimationFrame(animationFrameId);
        }

        if (snakeGameActive) {
            snakeGameActive = false;
            cancelAnimationFrame(snakeAnimationId);
        }

        if (emplatadoActive) {
            emplatadoActive = false;
            cancelAnimationFrame(emplatadoAnimationId);
        }

        if (equilibrioActive) {
            equilibrioActive = false;
            equilibrioKeys.clear();
            cancelAnimationFrame(equilibrioAnimationId);
        }

        // Reset GAME 1 elements
        if (ingredientDisplayArea) ingredientDisplayArea.style.display = 'none';
        if (knife) knife.style.display = 'none';
        if (cutsContainer) cutsContainer.innerHTML = '';
        gameInfoWrapper.classList.remove('active');
        gameInfoWrapper.classList.remove('snake-active');

        // Reset GAME 2 elements
        if (snakeCanvas) snakeCanvas.style.display = 'none';
        if (emplatadoCanvas) emplatadoCanvas.style.display = 'none';
        if (equilibrioCanvas) equilibrioCanvas.style.display = 'none';

        // Stop and reset video
        if (videoElement && !videoElement.paused) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }

        // Hide all containers first
        if (galleryContainer) galleryContainer.style.display = 'none';
        if (videoPlayerContainer) videoPlayerContainer.style.display = 'none';
        if (gameContainer) gameContainer.style.display = 'none';
        if (darkScreen) darkScreen.style.display = 'none';
        if (slicerPreview) slicerPreview.classList.remove('active');
        if (snakePreview) snakePreview.classList.remove('active');
        if (emplatadoPreview) emplatadoPreview.classList.remove('active');
        if (equilibrioPreview) equilibrioPreview.classList.remove('active');

        if (currentMenuIndex === GALLERY_INDEX) {
            // Show gallery
            if (galleryContainer) galleryContainer.style.display = 'block';
            startGalleryCrossfade();
        } else if (currentMenuIndex === VIDEO_INDEX) {
            // Show video
            if (videoPlayerContainer) videoPlayerContainer.style.display = 'block';
            stopGalleryCrossfade();
        } else if (currentMenuIndex === GAME1_INDEX || currentMenuIndex === GAME2_INDEX || currentMenuIndex === GAME3_INDEX || currentMenuIndex === GAME4_INDEX) {
            stopGalleryCrossfade();

            // Show preview screen instead of dark screen
            if (currentMenuIndex === GAME1_INDEX) {
                if (slicerPreview) slicerPreview.classList.add('active');
                messageText.innerHTML = "SLICER: Maestro del Corte<br><br>Corta ingredientes en tamaños ideales<br>A/Espacio: Hacer corte • B/Enter: Terminar<br><br>¡Presiona A o B para empezar!";
                contextText.textContent = "Listo para jugar";
                scoreText.textContent = "Puntaje: 0";
            } else if (currentMenuIndex === GAME2_INDEX) {
                if (snakePreview) snakePreview.classList.add('active');
                messageText.innerHTML = "SNAKE: Órdenes del Chef<br><br>Recoge platos del chef<br>Entrega al número de mesa correcto<br>Usa las flechas para moverte<br><br>¡Presiona A o B para empezar!";
                contextText.textContent = "Listo para jugar";
                scoreText.textContent = "Entregas: 0";
            } else if (currentMenuIndex === GAME3_INDEX) {
                if (emplatadoPreview) emplatadoPreview.classList.add('active');
                messageText.innerHTML = "EMPLATADO: Lo memorable nunca es perfecto<br><br>Coloca 5 elementos en el plato<br>A: Colocar • B: Cambiar elemento<br><br>¡Presiona A o B para empezar!";
                contextText.textContent = "Listo para jugar";
                scoreText.textContent = "Platos: 0";
            } else if (currentMenuIndex === GAME4_INDEX) {
                if (equilibrioPreview) equilibrioPreview.classList.add('active');
                messageText.innerHTML = "EQUILIBRIO: Ni orden ni caos<br><br>Atrapa lo justo — deja caer el resto<br>Flechas o A/B: Mover bandeja<br><br>¡Presiona A o B para empezar!";
                contextText.textContent = "Listo para jugar";
                scoreText.textContent = "Balance: 0";
            }

            if (gameContainer) gameContainer.style.display = 'none';
        } else if (currentMenuIndex === RESERVAR_INDEX) {
            stopGalleryCrossfade();
            if (gameContainer) gameContainer.style.display = 'flex';
            messageText.innerHTML = "RESERVAR<br><br>Abre el calendario de reservas<br><br>Presiona A o B";
            contextText.textContent = "Reservas";
            scoreText.textContent = "";
        } else if (currentMenuIndex === SETTINGS_INDEX) {
            stopGalleryCrossfade();
            if (gameContainer) gameContainer.style.display = 'flex';
            const theme = localStorage.getItem('pe-theme') || 'dark';
            messageText.innerHTML = `AJUSTES<br><br>A — Sonido: ${soundEnabled ? 'ON' : 'OFF'}<br>B — Tema: ${theme === 'light' ? 'CLARO' : 'OSCURO'}`;
            contextText.textContent = "Ajustes";
            scoreText.textContent = "";
        } else if (currentMenuIndex === ENTROPY_INDEX) {
            stopGalleryCrossfade();
            if (gameContainer) gameContainer.style.display = 'flex';
            const entropyEnabled = localStorage.getItem('pe-entropy') === '1';
            messageText.innerHTML = "MODO ENTROPÍA<br><br>El sitio entero se reorganiza<br>hacia el caos hermoso<br><br>Presiona A o B para alternar";
            contextText.textContent = "Modo Entropía";
            scoreText.textContent = entropyEnabled ? "Estado: ACTIVADO" : "Estado: DESACTIVADO";
        }
    }

    // ===== Nav-switch: physical rocker behavior =====
    // Pose is driven by CSS classes (is-up / is-down) that tilt the pill and
    // slide the cream band — never by swapping SVG geometry (the old sprite
    // swap used a different viewBox and read as a glitch-jump).
    const SWITCH_HOLD_DELAY = 380;   // ms held before auto-repeat kicks in
    const SWITCH_HOLD_REPEAT = 170;  // ms between repeats while held
    let switchHoldTimer = null;
    let switchRepeatTimer = null;
    let switchFlashTimer = null;
    let switchPointerId = null;

    function navigateMenu(dir) {
        if (menuButtons.length === 0) return;
        playButtonSound();
        currentMenuIndex = (currentMenuIndex + dir + menuButtons.length) % menuButtons.length;
        updateMenuSelectionDisplay();
    }

    function setSwitchPose(dir) {
        navSwitch.classList.toggle('is-up', dir === -1);
        navSwitch.classList.toggle('is-down', dir === 1);
    }

    function releaseSwitch() {
        setSwitchPose(0);
        clearTimeout(switchHoldTimer);
        clearInterval(switchRepeatTimer);
        switchHoldTimer = switchRepeatTimer = null;
        switchPointerId = null;
    }

    // Brief tilt when the menu is navigated from the keyboard
    function flashSwitchPose(dir) {
        setSwitchPose(dir);
        clearTimeout(switchFlashTimer);
        switchFlashTimer = setTimeout(() => {
            if (switchPointerId === null) setSwitchPose(0);
        }, 160);
    }

    navSwitch.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (menuButtons.length === 0) return;
        if (switchPointerId !== null) return; // one pointer at a time
        switchPointerId = event.pointerId;
        try { navSwitch.setPointerCapture(event.pointerId); } catch (_) {}

        const rect = navSwitch.getBoundingClientRect();
        const dir = (event.clientY - rect.top) < rect.height / 2 ? -1 : 1;
        setSwitchPose(dir);
        navigateMenu(dir);

        // Hold the stick to keep scrolling
        switchHoldTimer = setTimeout(() => {
            switchRepeatTimer = setInterval(() => navigateMenu(dir), SWITCH_HOLD_REPEAT);
        }, SWITCH_HOLD_DELAY);
    });

    ['pointerup', 'pointercancel'].forEach((type) =>
        navSwitch.addEventListener(type, (event) => {
            if (event.pointerId !== switchPointerId) return;
            releaseSwitch();
        })
    );

    menuButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            playButtonSound();
            currentMenuIndex = index;
            updateMenuSelectionDisplay();
        });
    });

    function playStartupAnimation() {
        return new Promise((resolve) => {
            // Hide preview screens
            if (slicerPreview) slicerPreview.classList.remove('active');
            if (snakePreview) snakePreview.classList.remove('active');

            // Show dark screen
            if (darkScreen) darkScreen.style.display = 'block';

            // Reset logo and line
            if (startupLogo) {
                startupLogo.style.opacity = '0';
                startupLogo.classList.remove('flickering');
            }
            if (startupLine) {
                startupLine.style.width = '0';
                startupLine.style.height = '2px';
                startupLine.classList.remove('animating');
            }

            // Show black logo with flicker and play startup sound
            setTimeout(() => {
                if (startupLogo) {
                    startupLogo.style.opacity = '1';
                    startupLogo.classList.add('flickering');
                }
                playStartupSound();
            }, 100);

            // Start line animation after logo flickers
            setTimeout(() => {
                if (startupLine) startupLine.classList.add('animating');
            }, 500);

            // Fade out logo as line expands
            setTimeout(() => {
                if (startupLogo) startupLogo.style.opacity = '0';
            }, 1400);

            // Hide dark screen after animation completes and show game
            setTimeout(() => {
                if (darkScreen) darkScreen.style.display = 'none';
                if (gameContainer) gameContainer.style.display = 'flex';
                if (startupLine) startupLine.classList.remove('animating');
                if (startupLogo) startupLogo.classList.remove('flickering');
                resolve();
            }, 1700); // Match animation duration
        });
    }

    async function initializeGameSession() {
        if (currentMenuIndex !== GAME1_INDEX && currentMenuIndex !== GAME2_INDEX) return;
        if (gameActive || snakeGameActive || emplatadoActive || equilibrioActive || bootInProgress) return;
        const session = ++gameSessionToken;
        bootInProgress = true;

        // Play startup animation before starting game
        await playStartupAnimation();
        bootInProgress = false;
        // Bail if the menu changed (or another session started) during the boot
        if (session !== gameSessionToken) return;

        gameActive = true;
        roundOver = false;

        if (videoPlayerContainer) videoPlayerContainer.style.display = 'none';
        if (videoElement && !videoElement.paused) {
            videoElement.pause();
        }

        totalGameScore = 0;
        currentIngredientIndex = 0;
        gameLevel = 1;
        currentKnifeSpeed = KNIFE_SPEED_BASE;
        ingredientsQueue = [...ALL_INGREDIENTS_DATA];
        shuffleArray(ingredientsQueue);

        // Show intro screen with title and description (centered)
        gameInfoWrapper.classList.remove('active');
        contextText.innerHTML = "<span style='font-size: clamp(12px, 2.5vw, 16px); font-weight: bold; display: block; margin-bottom: 8px;'>MAESTRO DEL CORTE</span>";
        scoreText.innerHTML = "<span style='font-size: clamp(6px, 1vw, 8px); opacity: 0.7; font-style: italic;'>Corta ingredientes en tamaños perfectos</span>";
        messageText.innerHTML = "¡Prepárate!<br>Observa el cuchillo y cronometra tus cortes<br><br>Puntaje: 0";

        // Play game start screen sound
        playGameStartSound();

        lastBPressTime = 0;
        setTimeout(() => { if (session === gameSessionToken) loadNextIngredient(); }, 1800);
    }

    function loadNextIngredient() {
        if (!gameActive) return;
        roundOver = false;
        buttonA.disabled = false;
        buttonB.disabled = false;
        knife.style.display = 'block';
        ingredientDisplayArea.style.display = 'flex';
        gameInfoWrapper.classList.add('active');

        if (mainIngredientSvgElement) {
            mainIngredientSvgElement.classList.remove('hidden');
        }

        if (currentIngredientIndex >= ingredientsQueue.length) {
            gameLevel++;
            currentIngredientIndex = 0;
            shuffleArray(ingredientsQueue);
            currentKnifeSpeed = KNIFE_SPEED_BASE + (gameLevel - 1) * 0.25;
            messageText.innerHTML = `¡Nivel ${gameLevel}!<br>¡Más Rápido!`;
            if (gameLevel > 3) {
                let gradeMessage;
                if (totalGameScore >= 1500) gradeMessage = "¡CHEF MAESTRO!";
                else if (totalGameScore >= 1000) gradeMessage = "¡EXPERTO CORTADOR!";
                else if (totalGameScore >= 600) gradeMessage = "¡COCINERO HÁBIL!";
                else if (totalGameScore >= 300) gradeMessage = "¡MEJORANDO!";
                else gradeMessage = "¡SIGUE PRACTICANDO!";

                endGameSession(`¡Todos los Niveles Completados!<br>${gradeMessage}<br>Puntaje Final: ${totalGameScore}`);
                return;
            }
            setTimeout(() => { if(gameActive) loadNextIngredient(); }, 1500);
            return;
        }

        currentIngredient = ingredientsQueue[currentIngredientIndex];
        currentIngredientIndex++;

        if (mainIngredientSvgElement && mainIngredientSvgElement.parentNode) {
            mainIngredientSvgElement.parentNode.removeChild(mainIngredientSvgElement);
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentIngredient.svgString;
        mainIngredientSvgElement = tempDiv.firstChild;
        if (mainIngredientSvgElement) {
            ingredientDisplayArea.insertBefore(mainIngredientSvgElement, cutsContainer);
        }

        contextText.textContent = `${currentIngredient.name} ${currentIngredient.context}`;
        slicesMade = [];
        currentPassCount = 0;
        cutsContainer.innerHTML = '';

        knifePositionPx = 0;
        knife.style.transform = `translateX(0px)`;
        knifeDirection = 1;

        const controlHint = `${currentIngredient.context}<br>Cortes ideales: ${currentIngredient.targetSlicesPerPass}<br><span style="opacity: 0.7; font-size: 0.9em;">A: Cortar | B: Terminar</span>`;
        messageText.innerHTML = controlHint;
        startKnifeAnimation();
    }

    function startKnifeAnimation() {
        cancelAnimationFrame(animationFrameId);
        const travelWidth = ingredientDisplayArea.clientWidth - knife.offsetWidth;

        function animateKnifeMovement() {
            if (!gameActive || roundOver) return;
            knifePositionPx += knifeDirection * currentKnifeSpeed;

            let passJustCompleted = false;
            if (knifePositionPx >= travelWidth) {
                knifePositionPx = travelWidth;
                knifeDirection = -1;
                passJustCompleted = true;
            } else if (knifePositionPx <= 0) {
                knifePositionPx = 0;
                knifeDirection = 1;
                if (currentPassCount > 0) {
                    currentPassCount++;
                    passJustCompleted = true;
                }
            }

            if (knifePositionPx >= travelWidth && currentPassCount === 0) {
                currentPassCount++;
            }

            knife.style.transform = `translateX(${knifePositionPx}px)`;

            if (passJustCompleted && currentPassCount >= MAX_PASSES) {
                finalizeSlicing();
                return;
            }
            animationFrameId = requestAnimationFrame(animateKnifeMovement);
        }
        animateKnifeMovement();
    }

    function recordSlice() {
        if (!gameActive || roundOver || !currentIngredient || currentPassCount >= MAX_PASSES) return;

        const ingredientWidthPx = ingredientDisplayArea.clientWidth;
        if (ingredientWidthPx === 0) return;

        // Play chop sound
        playChopSound();

        // Visual feedback - knife glows green on cut
        knife.classList.add('cutting');
        setTimeout(() => {
            knife.classList.remove('cutting');
        }, 150);

        slicesMade.push({ positionPx: knifePositionPx });

        const cutLine = document.createElement('div');
        cutLine.classList.add('cut-line');
        cutLine.style.left = `${(knifePositionPx / ingredientWidthPx) * 100}%`;
        cutsContainer.appendChild(cutLine);

        const sliceCount = slicesMade.length;
        const targetSlices = currentIngredient.targetSlicesPerPass;
        let feedbackMsg = `¡Corte ${sliceCount}!`;

        if (sliceCount === targetSlices) {
            feedbackMsg = `¡Corte ${sliceCount} - PERFECTO!`;
        } else if (sliceCount < targetSlices) {
            feedbackMsg += ` (${targetSlices - sliceCount} más)`;
        } else {
            feedbackMsg += ` (muchos cortes)`;
        }

        feedbackMsg += '<br><span style="opacity: 0.7; font-size: 0.9em;">B para terminar</span>';
        messageText.innerHTML = feedbackMsg;
    }

    function finalizeSlicing() {
        if (!gameActive || roundOver) return;
        roundOver = true;
        buttonA.disabled = true;
        buttonB.disabled = true;
        knife.style.display = 'none';

        cancelAnimationFrame(animationFrameId);
        messageText.innerHTML = "¡Cortado! Analizando...";

        slicesMade.sort((a, b) => a.positionPx - b.positionPx);

        const containerWidthPx = ingredientDisplayArea.clientWidth;

        // Get the actual SVG bounds relative to the container
        const svgRect = mainIngredientSvgElement ? mainIngredientSvgElement.getBoundingClientRect() : null;
        const containerRect = ingredientDisplayArea.getBoundingClientRect();

        // Calculate SVG position within container
        const svgLeft = svgRect ? (svgRect.left - containerRect.left) : 0;
        const svgWidth = svgRect ? svgRect.width : containerWidthPx;
        const svgRight = svgLeft + svgWidth;

        // Calculate slice widths relative to the SVG bounds (not container bounds)
        const sliceWidthsPx = [];
        let lastCutPositionPx = svgLeft; // Start from SVG left edge, not container edge

        slicesMade.forEach(slice => {
            // Only count cuts that are within the SVG bounds
            const cutPos = Math.max(svgLeft, Math.min(svgRight, slice.positionPx));
            if (cutPos > lastCutPositionPx) {
                sliceWidthsPx.push(cutPos - lastCutPositionPx);
                lastCutPositionPx = cutPos;
            }
        });
        // Add the final slice (from last cut to SVG right edge)
        if (svgRight > lastCutPositionPx) {
            sliceWidthsPx.push(svgRight - lastCutPositionPx);
        }

        const numActualSlicesMade = slicesMade.length;
        const numResultingPieces = sliceWidthsPx.length;

        let precisionScore = 0, speedScore = 0, widthQualityScore = 0, sliceCountScore = 0;

        // Precision: How uniform are the slices?
        if (numActualSlicesMade === 0) {
        } else if (numResultingPieces > 1) {
            const meanWidth = sliceWidthsPx.reduce((sum, w) => sum + w, 0) / numResultingPieces;
            const variance = sliceWidthsPx.reduce((sum, w) => sum + Math.pow(w - meanWidth, 2), 0) / numResultingPieces;
            const stdDev = Math.sqrt(variance);
            const relativeStdDev = meanWidth > 0 ? stdDev / meanWidth : 1;
            precisionScore = Math.max(0, 1 - (relativeStdDev - 0.05) / 0.35);
        } else { precisionScore = 0.5; }

        // Speed: How many passes were used?
        const passesEffectivelyUsed = Math.min(MAX_PASSES, Math.max(1, currentPassCount));
        const idealPassesForCuts = Math.ceil(numActualSlicesMade / currentIngredient.targetSlicesPerPass);
        speedScore = (passesEffectivelyUsed <= idealPassesForCuts) ? 1.0 : Math.max(0.1, 1.0 - (passesEffectivelyUsed - idealPassesForCuts) * 0.25);
        if (numActualSlicesMade === 0) speedScore = 0;

        // Width Quality: Are slices within ideal width range?
        let totalWidthQuality = 0;
        sliceWidthsPx.forEach(pxWidth => {
            const { idealWidthMin, idealWidthMax } = currentIngredient;
            if (pxWidth >= idealWidthMin && pxWidth <= idealWidthMax) {
                totalWidthQuality += 1.0;
            } else {
                const centerIdeal = (idealWidthMin + idealWidthMax) / 2;
                const deviation = Math.abs(pxWidth - centerIdeal) - ((idealWidthMax - idealWidthMin) / 2);
                totalWidthQuality += Math.max(0, 1.0 - (deviation / (centerIdeal > 0 ? centerIdeal : 1)) * 1.2);
            }
        });
        widthQualityScore = numResultingPieces > 0 ? totalWidthQuality / numResultingPieces : 0;
        if (numActualSlicesMade === 0) widthQualityScore = 0;

        // Slice Count: How close to target number of slices?
        if (numActualSlicesMade > 0) {
            const targetSlices = currentIngredient.targetSlicesPerPass;
            const sliceDifference = Math.abs(numActualSlicesMade - targetSlices);
            sliceCountScore = Math.max(0, 1.0 - (sliceDifference / targetSlices) * 0.5);
        }

        let bonusScore = 0;
        if (numActualSlicesMade > 0) {
            const perfectCuts = sliceWidthsPx.filter(width => {
                const { idealWidthMin, idealWidthMax } = currentIngredient;
                return width >= idealWidthMin && width <= idealWidthMax;
            }).length;

            if (perfectCuts === numResultingPieces && numResultingPieces >= 2) {
                bonusScore += 25;
            }

            if (currentPassCount === 1 && numActualSlicesMade >= 2) {
                bonusScore += 15;
            }

            if (numActualSlicesMade === currentIngredient.targetSlicesPerPass) {
                bonusScore += 10;
            }
        }

        const baseScore = (numActualSlicesMade > 0) ? Math.round((precisionScore * 0.3 + speedScore * 0.25 + widthQualityScore * 0.25 + sliceCountScore * 0.2) * 100) : 0;
        const roundScore = baseScore + bonusScore;
        totalGameScore += roundScore;

        // Play slice result sound
        if (numActualSlicesMade > 0) {
            playSliceResultSound();
        }

        scoreText.textContent = `Puntaje: ${totalGameScore}`;
        if (numActualSlicesMade > 0) {
            let bonusText = bonusScore > 0 ? `<br>+${bonusScore} ¡BONUS!` : '';
            messageText.innerHTML = `¡Puntaje: ${roundScore}!<br><span style="font-size: 0.85em; opacity: 0.8;">P:${Math.round(precisionScore*100)} V:${Math.round(speedScore*100)} A:${Math.round(widthQualityScore*100)} C:${Math.round(sliceCountScore*100)}</span>${bonusText}`;
        } else {
            messageText.innerHTML = "¡No se hicieron cortes!";
        }

        // Use the SVG dimensions already captured above
        const svgRenderedHeight = svgRect ? svgRect.height : ingredientDisplayArea.clientHeight;
        displaySlicedResult(sliceWidthsPx, svgWidth, svgRenderedHeight);

        const displayTime = bonusScore > 0 ? 6000 : 4000;
        setTimeout(() => {
            if (gameActive) loadNextIngredient();
        }, displayTime);
    }

    function displaySlicedResult(widths, svgWidth, svgHeight) {
        if (mainIngredientSvgElement) {
            mainIngredientSvgElement.classList.add('hidden');
        }
        cutsContainer.innerHTML = '';

        const { idealWidthMin, idealWidthMax } = currentIngredient;

        // Get the original SVG's viewBox to calculate slice viewBoxes
        let svgToClone = mainIngredientSvgElement;
        if (!svgToClone && currentIngredient && currentIngredient.svgString) {
            const temp = document.createElement('div');
            temp.innerHTML = currentIngredient.svgString;
            svgToClone = temp.querySelector('svg');
        }
        if (!svgToClone) return;

        // Parse original viewBox
        const originalViewBox = svgToClone.getAttribute('viewBox');
        if (!originalViewBox) return;

        const vbParts = originalViewBox.split(/\s+/).map(Number);
        const vbX = vbParts[0] || 0;
        const vbY = vbParts[1] || 0;
        const vbWidth = vbParts[2];
        const vbHeight = vbParts[3];

        // The ingredient SVG renders with preserveAspectRatio "meet": the drawing
        // is letterboxed inside the element box. Compute the DRAWN geometry so
        // pieces show the fruit at its true scale (no preserveAspectRatio:none
        // stretching — that was the distortion bug).
        const fitScale = Math.min(svgWidth / vbWidth, svgHeight / vbHeight);
        const drawnW = vbWidth * fitScale;
        const drawnH = vbHeight * fitScale;
        const drawnX0 = (svgWidth - drawnW) / 2;

        let currentXOffset = 0;

        widths.forEach((sliceWidth, index) => {
            if (sliceWidth < 1) return;

            const sliceWrapper = document.createElement('div');
            sliceWrapper.classList.add('slice-piece-wrapper');
            sliceWrapper.style.width = `${sliceWidth}px`;
            sliceWrapper.style.height = `${drawnH}px`;
            sliceWrapper.style.flex = '0 0 auto';

            const isPerfect = sliceWidth >= idealWidthMin && sliceWidth <= idealWidthMax;
            if (isPerfect) {
                sliceWrapper.classList.add('perfect');
            }

            // Full drawing at its true rendered size, shifted so this piece's
            // window shows its exact portion. overflow:hidden crops it.
            const clonedSvg = svgToClone.cloneNode(true);
            clonedSvg.removeAttribute('id');
            clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            clonedSvg.style.position = 'absolute';
            clonedSvg.style.width = `${drawnW}px`;
            clonedSvg.style.height = `${drawnH}px`;
            clonedSvg.style.left = `${drawnX0 - currentXOffset}px`;
            clonedSvg.style.top = '0';
            clonedSvg.style.display = 'block';
            clonedSvg.style.maxWidth = 'none';

            sliceWrapper.appendChild(clonedSvg);

            const measurementDiv = document.createElement('div');
            measurementDiv.classList.add('measurement-text');
            measurementDiv.textContent = `${Math.round(sliceWidth)}px`;
            if (isPerfect) {
                measurementDiv.classList.add('perfect');
            }
            sliceWrapper.appendChild(measurementDiv);

            setTimeout(() => {
                sliceWrapper.classList.add('animate');
            }, index * 150);

            cutsContainer.appendChild(sliceWrapper);

            currentXOffset += sliceWidth;
        });
    }

    function endGameSession(finalMessage) {
        gameActive = false;
        roundOver = true;
        cancelAnimationFrame(animationFrameId);
        messageText.innerHTML = `${finalMessage}<br>Jugar de Nuevo: SLICER + A/B`;
        contextText.textContent = "¡Juego Terminado!";
        gameInfoWrapper.classList.remove('active');

        if (videoPlayerContainer) videoPlayerContainer.style.display = 'none';
        if (videoElement && !videoElement.paused) {
            videoElement.pause();
        }

        if (gameContainer) gameContainer.style.display = 'flex';

        updateMenuSelectionDisplay();
        buttonA.disabled = false;
        buttonB.disabled = false;
    }

    // ========== GAME 2: Snake Game Functions ==========

    function initSnakeCanvas() {
        if (!snakeCanvas) return;

        // Get the game container's available space
        const container = snakeCanvas.parentElement;
        const containerRect = container.getBoundingClientRect();

        // Calculate available height (container height minus info section)
        const infoSection = document.getElementById('game-info-wrapper');
        const infoHeight = infoSection ? infoSection.offsetHeight + 15 : 80;

        // Calculate available dimensions - maximize usage
        const availableWidth = containerRect.width - 30; // minimal padding
        const availableHeight = containerRect.height - infoHeight - 10;

        // Use the full available space - no fixed aspect ratio
        let displayWidth = availableWidth;
        let displayHeight = availableHeight;

        // Set canvas CSS size explicitly to fill available space
        snakeCanvas.style.width = displayWidth + 'px';
        snakeCanvas.style.height = displayHeight + 'px';

        // Set canvas resolution (use device pixel ratio for sharp rendering)
        const dpr = window.devicePixelRatio || 1;
        snakeCanvas.width = Math.floor(displayWidth * dpr);
        snakeCanvas.height = Math.floor(displayHeight * dpr);

        // Scale context to match device pixel ratio
        snakeCtx.scale(dpr, dpr);

        // Calculate grid dimensions - smaller cells for tighter game
        const targetCellSize = Math.max(16, Math.floor(displayHeight / 14));
        gridWidth = Math.floor(displayWidth / targetCellSize);
        gridHeight = Math.floor(displayHeight / targetCellSize);

        // Store actual cell size for drawing (square cells)
        const cellSize = Math.min(displayWidth / gridWidth, displayHeight / gridHeight);
        snakeCanvas.cellWidth = cellSize;
        snakeCanvas.cellHeight = cellSize;
    }

    function initSnakeGame() {
        snakeGameActive = true;
        snakeScore = 0;
        snakeDirection = 'right';
        snakeSpeed = 150;
        lastSnakeMoveTime = 0;
        deliveriesCompleted = 0;
        currentPlate = null;
        availablePlate = null;

        // Helper function to check if position is too close to existing positions
        function isTooClose(x, y, positions, minDistance) {
            for (const pos of positions) {
                const dist = Math.abs(pos.x - x) + Math.abs(pos.y - y);
                if (dist < minDistance) return true;
            }
            return false;
        }

        // Generate random position within bounds
        function getRandomPosition(minX, maxX, minY, maxY, existingPositions, minDistance) {
            let attempts = 0;
            while (attempts < 50) {
                const x = minX + Math.floor(Math.random() * (maxX - minX));
                const y = minY + Math.floor(Math.random() * (maxY - minY));
                if (!isTooClose(x, y, existingPositions, minDistance)) {
                    return { x, y };
                }
                attempts++;
            }
            // Fallback if no valid position found
            return { x: minX + Math.floor((maxX - minX) / 2), y: minY + Math.floor((maxY - minY) / 2) };
        }

        const usedPositions = [];
        const margin = 3; // Keep away from edges
        const minDistance = 4; // Minimum distance between elements

        // Chef station - random position
        chefStation = getRandomPosition(margin, gridWidth - margin, margin, gridHeight - margin, usedPositions, minDistance);
        usedPositions.push(chefStation);

        // Initialize snake (waiter) near the middle, away from chef
        const startX = Math.floor(gridWidth / 2);
        const startY = Math.floor(gridHeight / 2);
        snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        // Add snake positions to used positions
        snake.forEach(seg => usedPositions.push(seg));

        // Create tables at random positions (5 tables numbered 1-5)
        tables = [];
        for (let i = 0; i < 5; i++) {
            const tablePos = getRandomPosition(margin, gridWidth - margin, margin, gridHeight - margin, usedPositions, minDistance);
            tables.push({
                x: tablePos.x,
                y: tablePos.y,
                number: i + 1
            });
            usedPositions.push(tablePos);
        }

        // Reset red fruit / power-up variables
        redFruit = null;
        redSegmentCount = 0;
        activePowerUp = null;
        powerUpTimer = 0;
        preSpeedPowerUpSpeed = 150;

        // Spawn first plate at chef station
        spawnPlate();

        // Update UI - add snake-active class for divider styling
        gameInfoWrapper.classList.add('snake-active');
        scoreText.textContent = `Entregas: ${deliveriesCompleted}`;
        contextText.textContent = "¡Entrega platos a las mesas correspondientes!";
        messageText.innerHTML = "Recoge platos del chef<br>Entrega al número de mesa correspondiente";

        // Start game loop
        snakeAnimationId = requestAnimationFrame(snakeGameLoop);
    }

    function spawnPlate() {
        // Only spawn a new plate if there isn't one waiting
        if (!availablePlate) {
            // Random number from 1-5 for table matching
            availablePlate = Math.floor(Math.random() * 5) + 1;
        }
    }

    // Spawn red fruit at random position
    function spawnRedFruit() {
        if (redFruit) return; // Already exists

        const margin = 2;
        let attempts = 0;
        while (attempts < 50) {
            const x = margin + Math.floor(Math.random() * (gridWidth - margin * 2));
            const y = margin + Math.floor(Math.random() * (gridHeight - margin * 2));

            // Check not on snake, chef, or tables
            const onSnake = snake.some(s => s.x === x && s.y === y);
            const onChef = Math.abs(x - chefStation.x) <= 1 && Math.abs(y - chefStation.y) <= 1;
            const onTable = tables.some(t => Math.abs(x - t.x) <= 1 && Math.abs(y - t.y) <= 1);

            if (!onSnake && !onChef && !onTable) {
                redFruit = { x, y };
                messageText.innerHTML = "¡Fruta especial apareció!";
                return;
            }
            attempts++;
        }
    }

    // Randomize table positions (used when 3 red segments trigger)
    function randomizeTablePositions() {
        const usedPositions = [chefStation];
        snake.forEach(seg => usedPositions.push(seg));

        const margin = 3;
        const minDistance = 4;

        function isTooClose(x, y, positions, minDist) {
            for (const pos of positions) {
                if (Math.abs(pos.x - x) + Math.abs(pos.y - y) < minDist) return true;
            }
            return false;
        }

        tables.forEach(table => {
            let attempts = 0;
            while (attempts < 50) {
                const x = margin + Math.floor(Math.random() * (gridWidth - margin * 2));
                const y = margin + Math.floor(Math.random() * (gridHeight - margin * 2));
                if (!isTooClose(x, y, usedPositions, minDistance)) {
                    table.x = x;
                    table.y = y;
                    usedPositions.push({ x, y });
                    break;
                }
                attempts++;
            }
        });
    }

    // Activate a random power-up
    function activatePowerUp() {
        const powers = ['speed', 'ghost', 'magnet'];
        activePowerUp = powers[Math.floor(Math.random() * powers.length)];
        powerUpTimer = 150; // ~22 seconds at 150ms per move (longer duration)

        switch (activePowerUp) {
            case 'speed':
                messageText.innerHTML = "¡SUPER VELOCIDAD ACTIVADA!";
                preSpeedPowerUpSpeed = snakeSpeed; // Store current speed
                snakeSpeed = Math.max(40, snakeSpeed - 70); // Bigger speed boost
                break;
            case 'ghost':
                messageText.innerHTML = "¡MODO FANTASMA! ¡Atraviesa paredes!";
                break;
            case 'magnet':
                messageText.innerHTML = "¡IMÁN ACTIVO! ¡Puntos x2!";
                break;
        }

        // Flash the snake head briefly to indicate power-up activated
        contextText.textContent = `¡PODER ${activePowerUp.toUpperCase()} ACTIVADO!`;
    }

    function isValidDirection(newDirection) {
        // Prevent moving in opposite direction (would cause immediate collision)
        const opposites = {
            'up': 'down',
            'down': 'up',
            'left': 'right',
            'right': 'left'
        };
        return opposites[snakeDirection] !== newDirection;
    }

    function rotateSnakeDirection(clockwise) {
        // Button A: Clockwise rotation (right -> down -> left -> up -> right)
        // Button B: Counter-clockwise rotation (right -> up -> left -> down -> right)
        if (clockwise) {
            switch (snakeDirection) {
                case 'up': snakeDirection = 'right'; break;
                case 'right': snakeDirection = 'down'; break;
                case 'down': snakeDirection = 'left'; break;
                case 'left': snakeDirection = 'up'; break;
            }
        } else {
            switch (snakeDirection) {
                case 'up': snakeDirection = 'left'; break;
                case 'left': snakeDirection = 'down'; break;
                case 'down': snakeDirection = 'right'; break;
                case 'right': snakeDirection = 'up'; break;
            }
        }

        // Play move sound when changing direction
        playSnakeMoveSound();
    }

    function moveSnake() {
        const head = { ...snake[0] };

        // Move head in current direction
        switch (snakeDirection) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        // Check wall collision (ghost power allows wrapping)
        if (head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight) {
            if (activePowerUp === 'ghost') {
                // Wrap around
                if (head.x < 0) head.x = gridWidth - 1;
                if (head.x >= gridWidth) head.x = 0;
                if (head.y < 0) head.y = gridHeight - 1;
                if (head.y >= gridHeight) head.y = 0;
            } else {
                endSnakeGame(`¡Chocaste con la pared!<br>Entregas: ${deliveriesCompleted}`);
                return false;
            }
        }

        // Check if eating own tail (last segment only - risky move!)
        const tail = snake[snake.length - 1];
        const eatingTail = head.x === tail.x && head.y === tail.y && snake.length > 3;

        if (eatingTail) {
            // Check if tail is red - gives power-up!
            if (snake[snake.length - 1].isRed && redSegmentCount > 0) {
                // Eating red tail - activate power-up!
                activatePowerUp();
                redSegmentCount--;
                snake.pop(); // Remove the eaten red tail
                messageText.innerHTML = "¡Comiste tu cola roja! ¡Poder activado!";
            } else {
                // Eating normal tail - just shrink (risky but helpful)
                snake.pop();
                messageText.innerHTML = "¡Te comiste la cola! Ahora eres más corto";
            }
        }

        // Check self collision (excluding tail we might be eating)
        const bodyWithoutTail = snake.slice(0, -1);
        if (bodyWithoutTail.some(segment => segment.x === head.x && segment.y === head.y)) {
            endSnakeGame(`¡Chocaste contigo mismo!<br>Entregas: ${deliveriesCompleted}`);
            return false;
        }

        // Add new head
        snake.unshift(head);

        // Decrement power-up timer
        if (powerUpTimer > 0) {
            powerUpTimer--;
            if (powerUpTimer === 0) {
                // Power-up expired
                if (activePowerUp === 'speed') {
                    snakeSpeed = preSpeedPowerUpSpeed; // Restore original speed
                }
                activePowerUp = null;
                messageText.innerHTML = "¡Poder terminado!";
                contextText.textContent = currentPlate ? `Llevando plato #${currentPlate}` : "¡Recoge un plato del chef!";
            }
        }

        // Helper function to check if head is within a multi-cell area
        const isNearChef = (hx, hy) => {
            const dx = Math.abs(hx - chefStation.x);
            const dy = Math.abs(hy - chefStation.y);
            return dx <= 1 && dy <= 1;
        };

        const isNearTable = (hx, hy, table) => {
            const dx = Math.abs(hx - table.x);
            const dy = Math.abs(hy - table.y);
            return dx <= 1 && dy <= 1;
        };

        // Check red fruit collection
        if (redFruit && head.x === redFruit.x && head.y === redFruit.y) {
            // Collected red fruit - mark the LAST existing segment as red
            redFruit = null;
            redSegmentCount++;

            // Find the last non-red segment and mark it as red
            // This makes the red segments accumulate at the tail
            for (let i = snake.length - 1; i >= 0; i--) {
                if (!snake[i].isRed) {
                    snake[i].isRed = true;
                    break;
                }
            }

            messageText.innerHTML = `¡Fruta roja! (${redSegmentCount}/3) - Come tu cola roja para poder especial`;

            // Check if we have 3 red segments - CHAOS MODE!
            if (redSegmentCount >= 3) {
                // Remove 3 red + 3 normal = 6 segments
                const segmentsToRemove = Math.min(6, snake.length - 3); // Keep at least 3
                for (let i = 0; i < segmentsToRemove; i++) {
                    snake.pop();
                }
                redSegmentCount = 0;

                // Reset isRed on remaining segments
                snake.forEach(seg => seg.isRed = false);

                // Randomize all table positions
                randomizeTablePositions();

                messageText.innerHTML = "¡CAOS! ¡Las mesas cambiaron de lugar!";
            }
        }

        // Check chef station - pick up plate
        if (isNearChef(head.x, head.y) && availablePlate && !currentPlate) {
            currentPlate = availablePlate;
            availablePlate = null;
            contextText.textContent = `Llevando plato #${currentPlate} - ¡Encuentra mesa ${currentPlate}!`;

            startSnakeCarryingLoop();
            // Don't remove tail - grow
        } else if (currentPlate) {
            // Check if at correct table
            const targetTable = tables.find(t => t.number === currentPlate);
            if (targetTable && isNearTable(head.x, head.y, targetTable)) {
                // Successful delivery!
                deliveriesCompleted++;
                const pointsEarned = activePowerUp === 'magnet' ? 20 : 10;
                snakeScore += pointsEarned;
                scoreText.textContent = `Entregas: ${deliveriesCompleted}`;
                currentPlate = null;

                stopSnakeCarryingLoop();
                playSnakeDeliverSound();

                spawnPlate();
                contextText.textContent = activePowerUp === 'magnet'
                    ? "¡Plato entregado! +20 puntos (IMÁN)"
                    : "¡Plato entregado! ¡Vuelve con el chef!";

                // Spawn red fruit every 10 points (1 delivery)
                if (deliveriesCompleted % 1 === 0 && !redFruit) {
                    spawnRedFruit();
                }

                if (snakeSpeed > 70) {
                    snakeSpeed -= 3;
                }
                // Don't remove tail - grow
            } else {
                snake.pop();
            }
        } else {
            snake.pop();
        }

        return true;
    }

    function drawSnake() {
        if (!snakeCtx || !snakeCanvas) return;

        const cellW = snakeCanvas.cellWidth || 20;
        const cellH = snakeCanvas.cellHeight || 20;
        const rect = snakeCanvas.getBoundingClientRect();

        // Clear canvas
        snakeCtx.fillStyle = '#0d161d';
        snakeCtx.fillRect(0, 0, rect.width, rect.height);

        // Draw subtle floor grid
        snakeCtx.strokeStyle = '#1a2530';
        snakeCtx.lineWidth = 1;
        for (let x = 0; x <= gridWidth; x++) {
            snakeCtx.beginPath();
            snakeCtx.moveTo(x * cellW, 0);
            snakeCtx.lineTo(x * cellW, rect.height);
            snakeCtx.stroke();
        }
        for (let y = 0; y <= gridHeight; y++) {
            snakeCtx.beginPath();
            snakeCtx.moveTo(0, y * cellH);
            snakeCtx.lineTo(rect.width, y * cellH);
            snakeCtx.stroke();
        }

        // Draw chef station - same size as tables, filled yellow
        const chefX = chefStation.x * cellW;
        const chefY = chefStation.y * cellH;
        const tableSize = cellW * 1.8; // Same size as tables

        // Kitchen counter - brand yellow color (filled)
        snakeCtx.fillStyle = '#efa02e';
        snakeCtx.beginPath();
        snakeCtx.roundRect(chefX - tableSize / 2, chefY - tableSize / 2, tableSize, tableSize, 6);
        snakeCtx.fill();

        // "CHEF" label - at top of station
        snakeCtx.fillStyle = '#0d161d';
        snakeCtx.font = `bold ${Math.floor(cellW * 0.32)}px Arial`;
        snakeCtx.textAlign = 'center';
        snakeCtx.textBaseline = 'middle';
        snakeCtx.fillText('CHEF', chefX, chefY - cellH * 0.5);

        // Draw available plate at chef station
        if (availablePlate) {
            // Plate circle - flat white/cream, positioned lower
            snakeCtx.fillStyle = '#e8d5c4';
            snakeCtx.beginPath();
            snakeCtx.arc(chefX, chefY + cellH * 0.15, cellW * 0.4, 0, Math.PI * 2);
            snakeCtx.fill();

            // Plate number
            snakeCtx.fillStyle = '#0d161d';
            snakeCtx.font = `bold ${Math.floor(cellW * 0.45)}px Arial`;
            snakeCtx.textAlign = 'center';
            snakeCtx.textBaseline = 'middle';
            snakeCtx.fillText(availablePlate.toString(), chefX, chefY + cellH * 0.15);
        }

        // Draw tables - outline only with background fill
        tables.forEach(table => {
            const tableX = table.x * cellW;
            const tableY = table.y * cellH;
            const tblSize = cellW * 1.8;

            // Table background - same as game background
            snakeCtx.fillStyle = '#0d161d';
            snakeCtx.beginPath();
            snakeCtx.roundRect(tableX - tblSize / 2, tableY - tblSize / 2, tblSize, tblSize, 6);
            snakeCtx.fill();

            // Table outline - brand yellow
            snakeCtx.strokeStyle = '#efa02e';
            snakeCtx.lineWidth = 3;
            snakeCtx.beginPath();
            snakeCtx.roundRect(tableX - tblSize / 2, tableY - tblSize / 2, tblSize, tblSize, 6);
            snakeCtx.stroke();

            // Table number - yellow text
            snakeCtx.fillStyle = '#efa02e';
            snakeCtx.font = `bold ${Math.floor(cellW * 0.7)}px Arial`;
            snakeCtx.textAlign = 'center';
            snakeCtx.textBaseline = 'middle';
            snakeCtx.fillText(table.number.toString(), tableX, tableY);
        });

        // Draw red fruit if exists
        if (redFruit) {
            const fruitX = redFruit.x * cellW;
            const fruitY = redFruit.y * cellH;
            const fruitSize = cellW * 0.7;

            // Red fruit - pulsing effect
            const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
            snakeCtx.fillStyle = RED_COLOR;
            snakeCtx.beginPath();
            snakeCtx.arc(fruitX + cellW / 2, fruitY + cellH / 2, fruitSize / 2 * pulse, 0, Math.PI * 2);
            snakeCtx.fill();

            // Shine effect
            snakeCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            snakeCtx.beginPath();
            snakeCtx.arc(fruitX + cellW * 0.4, fruitY + cellH * 0.4, fruitSize / 6, 0, Math.PI * 2);
            snakeCtx.fill();
        }

        // Draw waiter (snake) - plate becomes the front when carrying
        const head = snake[0];
        const segSize = cellW * 0.85;
        const offset = (cellW - segSize) / 2;

        // If carrying plate, draw the plate as the new "head" in front
        if (currentPlate) {
            // Calculate plate position in front of head based on direction
            let plateX = head.x * cellW;
            let plateY = head.y * cellH;

            if (snakeDirection === 'right') {
                plateX += cellW;
            } else if (snakeDirection === 'left') {
                plateX -= cellW;
            } else if (snakeDirection === 'up') {
                plateY -= cellH;
            } else {
                plateY += cellH;
            }

            // Draw plate as front segment (circle)
            snakeCtx.fillStyle = '#e8d5c4';
            snakeCtx.beginPath();
            snakeCtx.arc(plateX + cellW / 2, plateY + cellH / 2, cellW * 0.45, 0, Math.PI * 2);
            snakeCtx.fill();

            // Plate number
            snakeCtx.fillStyle = '#0d161d';
            snakeCtx.font = `bold ${Math.floor(cellW * 0.55)}px Arial`;
            snakeCtx.textAlign = 'center';
            snakeCtx.textBaseline = 'middle';
            snakeCtx.fillText(currentPlate.toString(), plateX + cellW / 2, plateY + cellH / 2);
        }

        // Draw snake body segments
        snake.forEach((segment, index) => {
            const segX = segment.x * cellW;
            const segY = segment.y * cellH;

            if (index === 0) {
                // Head - color changes based on active power-up
                let headColor = '#efa02e'; // Default yellow
                if (activePowerUp && powerUpTimer > 0) {
                    if (activePowerUp === 'speed') {
                        headColor = '#00ff88'; // Neon green for speed
                        snakeCtx.shadowColor = '#00ff88';
                        snakeCtx.shadowBlur = 12;
                    } else if (activePowerUp === 'ghost') {
                        headColor = '#9966ff'; // Purple for ghost
                        snakeCtx.shadowColor = '#9966ff';
                        snakeCtx.shadowBlur = 12;
                    } else if (activePowerUp === 'magnet') {
                        headColor = '#ff66aa'; // Pink for magnet
                        snakeCtx.shadowColor = '#ff66aa';
                        snakeCtx.shadowBlur = 12;
                    }
                }
                snakeCtx.fillStyle = headColor;
                snakeCtx.beginPath();
                snakeCtx.roundRect(segX + offset, segY + offset, segSize, segSize, 4);
                snakeCtx.fill();
                snakeCtx.shadowBlur = 0; // Reset shadow

                // Eyes based on direction
                snakeCtx.fillStyle = '#0d161d';
                const eyeSize = cellW * 0.12;
                if (snakeDirection === 'right') {
                    snakeCtx.beginPath();
                    snakeCtx.arc(segX + cellW * 0.7, segY + cellH * 0.35, eyeSize, 0, Math.PI * 2);
                    snakeCtx.arc(segX + cellW * 0.7, segY + cellH * 0.65, eyeSize, 0, Math.PI * 2);
                    snakeCtx.fill();
                } else if (snakeDirection === 'left') {
                    snakeCtx.beginPath();
                    snakeCtx.arc(segX + cellW * 0.3, segY + cellH * 0.35, eyeSize, 0, Math.PI * 2);
                    snakeCtx.arc(segX + cellW * 0.3, segY + cellH * 0.65, eyeSize, 0, Math.PI * 2);
                    snakeCtx.fill();
                } else if (snakeDirection === 'up') {
                    snakeCtx.beginPath();
                    snakeCtx.arc(segX + cellW * 0.35, segY + cellH * 0.3, eyeSize, 0, Math.PI * 2);
                    snakeCtx.arc(segX + cellW * 0.65, segY + cellH * 0.3, eyeSize, 0, Math.PI * 2);
                    snakeCtx.fill();
                } else {
                    snakeCtx.beginPath();
                    snakeCtx.arc(segX + cellW * 0.35, segY + cellH * 0.7, eyeSize, 0, Math.PI * 2);
                    snakeCtx.arc(segX + cellW * 0.65, segY + cellH * 0.7, eyeSize, 0, Math.PI * 2);
                    snakeCtx.fill();
                }
            } else {
                // Body segments - check if red or normal
                let bodyColor;
                if (segment.isRed) {
                    // Red segment - bright red for visibility
                    bodyColor = '#e63946'; // Bright red instead of muted gameboy color

                    // Draw outer glow first
                    snakeCtx.shadowColor = '#ff0000';
                    snakeCtx.shadowBlur = 8;
                    snakeCtx.fillStyle = bodyColor;
                    snakeCtx.beginPath();
                    snakeCtx.roundRect(segX + offset, segY + offset, segSize, segSize, 4);
                    snakeCtx.fill();
                    snakeCtx.shadowBlur = 0;

                    // Add pulsing border
                    const pulse = 1 + Math.sin(Date.now() / 150) * 0.3;
                    snakeCtx.strokeStyle = '#ff6b6b';
                    snakeCtx.lineWidth = 2 * pulse;
                    snakeCtx.beginPath();
                    snakeCtx.roundRect(segX + offset, segY + offset, segSize, segSize, 4);
                    snakeCtx.stroke();

                    // Add inner highlight
                    snakeCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    snakeCtx.beginPath();
                    snakeCtx.arc(segX + cellW * 0.35, segY + cellH * 0.35, segSize / 6, 0, Math.PI * 2);
                    snakeCtx.fill();
                } else {
                    // Normal body - alternating yellow/dark yellow
                    bodyColor = index % 2 === 0 ? '#efa02e' : '#bf8024';
                    snakeCtx.fillStyle = bodyColor;
                    snakeCtx.beginPath();
                    snakeCtx.roundRect(segX + offset + 1, segY + offset + 1, segSize - 2, segSize - 2, 3);
                    snakeCtx.fill();
                }
            }
        });

        // Draw power-up indicator if active
        if (activePowerUp && powerUpTimer > 0) {
            const indicatorText = activePowerUp === 'speed' ? 'SPD' :
                                  activePowerUp === 'ghost' ? 'GHO' : 'MAG';
            snakeCtx.font = `bold ${Math.floor(cellW * 0.5)}px Arial`;
            snakeCtx.fillStyle = '#ffffff';
            snakeCtx.textAlign = 'left';
            snakeCtx.textBaseline = 'top';
            snakeCtx.fillText(indicatorText + ' ' + Math.ceil(powerUpTimer / 7), 10, 10);
        }
    }

    function snakeGameLoop(timestamp) {
        if (!snakeGameActive) return;

        // Time-based movement
        if (timestamp - lastSnakeMoveTime > snakeSpeed) {
            const alive = moveSnake();
            if (!alive) return;

            drawSnake();
            lastSnakeMoveTime = timestamp;
        }

        snakeAnimationId = requestAnimationFrame(snakeGameLoop);
    }

    function endSnakeGame(finalMessage) {
        snakeGameActive = false;
        gameActive = false;
        cancelAnimationFrame(snakeAnimationId);

        // Remove snake-active class for divider styling
        gameInfoWrapper.classList.remove('snake-active');

        // Stop carrying loop if playing
        stopSnakeCarryingLoop();

        // Play lose sound
        playSnakeLoseSound();

        messageText.innerHTML = `${finalMessage}<br>Jugar de Nuevo: SNAKE + A/B`;
        contextText.textContent = "¡Juego Terminado!";

        buttonA.disabled = false;
        buttonB.disabled = false;
    }

    async function initializeSnakeSession() {
        if (currentMenuIndex !== GAME2_INDEX) return;
        if (gameActive || snakeGameActive || emplatadoActive || equilibrioActive || bootInProgress) return;
        const session = ++gameSessionToken;
        bootInProgress = true;

        // Play startup animation first
        await playStartupAnimation();
        bootInProgress = false;
        // Bail if the menu changed (or another session started) during the boot
        if (session !== gameSessionToken) return;

        gameActive = true;

        if (videoPlayerContainer) videoPlayerContainer.style.display = 'none';
        if (videoElement && !videoElement.paused) {
            videoElement.pause();
        }

        // Hide GAME 1 elements
        ingredientDisplayArea.style.display = 'none';
        knife.style.display = 'none';
        cutsContainer.innerHTML = '';

        // Show game container and info
        if (gameContainer) gameContainer.style.display = 'flex';

        // DON'T add 'active' class yet - keep centered layout for intro screen
        gameInfoWrapper.classList.remove('active');

        // Set up initial UI state with title and description
        contextText.innerHTML = "<span style='font-size: clamp(12px, 2.5vw, 16px); font-weight: bold; display: block; margin-bottom: 8px;'>ÓRDENES DEL CHEF</span>";
        scoreText.innerHTML = "<span style='font-size: clamp(6px, 1vw, 8px); opacity: 0.7; font-style: italic;'>Entrega platos a las mesas correctas sin chocar</span>";
        messageText.innerHTML = "¡Prepárate!<br>Usa las flechas para moverte<br><br>Entregas: 0";

        // Play game start screen sound
        playGameStartSound();

        // Hide snake canvas initially, start game after delay
        if (snakeCanvas) snakeCanvas.style.display = 'none';

        // Wait 2.5 seconds showing instructions, then start the game
        setTimeout(() => {
            if (session !== gameSessionToken) return; // menu changed during intro
            // Now add active class for in-game layout
            gameInfoWrapper.classList.add('active');

            if (snakeCanvas) {
                snakeCanvas.style.display = 'block';
                initSnakeCanvas();
            }

            // Start the actual game
            initSnakeGame();
        }, 2500);
    }

    function resetToMainScreen() {
        // Stop and hide video
        if (videoPlayerContainer) {
            videoPlayerContainer.style.display = 'none';
        }
        if (videoElement && !videoElement.paused) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }

        // Hide game and dark screen
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }
        if (darkScreen) {
            darkScreen.style.display = 'none';
        }

        // End any active game
        if (gameActive) {
            gameActive = false;
            roundOver = true;
            cancelAnimationFrame(animationFrameId);
        }

        // End Snake game if active
        if (snakeGameActive) {
            snakeGameActive = false;
            cancelAnimationFrame(snakeAnimationId);
        }

        // End new canvas games if active
        if (emplatadoActive) {
            emplatadoActive = false;
            cancelAnimationFrame(emplatadoAnimationId);
        }
        if (equilibrioActive) {
            equilibrioActive = false;
            equilibrioKeys.clear();
            cancelAnimationFrame(equilibrioAnimationId);
        }

        // Reset GAME 1 UI
        ingredientDisplayArea.style.display = 'none';
        knife.style.display = 'none';
        cutsContainer.innerHTML = '';
        gameInfoWrapper.classList.remove('active');

        // Reset GAME 2 UI
        if (snakeCanvas) {
            snakeCanvas.style.display = 'none';
        }
        if (emplatadoCanvas) emplatadoCanvas.style.display = 'none';
        if (equilibrioCanvas) equilibrioCanvas.style.display = 'none';

        // Reset menu to gallery (first item)
        currentMenuIndex = GALLERY_INDEX;
        updateMenuSelectionDisplay();

        // Reset message
        contextText.textContent = "Cortando para...";
        scoreText.textContent = "Puntaje: 0";
        messageText.innerHTML = "";
    }

    // ========== GAMES 3 + 4: Shared Canvas Setup ==========
    const GAME_PALETTE = {
        dark: '#0d161d', cream: '#e8d5c4', goldLight: '#f3bc6c', fuel: '#efa02e',
        amberDark: '#d1892a', fawn: '#9b4933', walnut: '#442b26', olive: '#6b5d30'
    };
    const emplatadoCanvas = document.getElementById('emplatado-canvas');
    const emplatadoCtx = emplatadoCanvas ? emplatadoCanvas.getContext('2d') : null;
    const equilibrioCanvas = document.getElementById('equilibrio-canvas');
    const equilibrioCtx = equilibrioCanvas ? equilibrioCanvas.getContext('2d') : null;
    const equilibrioKeys = new Set();

    function sizeGameCanvas(canvas) {
        const container = canvas.parentElement;
        const containerRect = container.getBoundingClientRect();
        const infoSection = document.getElementById('game-info-wrapper');
        const infoHeight = infoSection ? infoSection.offsetHeight + 15 : 80;
        const displayWidth = containerRect.width - 30;
        const displayHeight = containerRect.height - infoHeight - 10;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(displayWidth * dpr);
        canvas.height = Math.floor(displayHeight * dpr);
        canvas.getContext('2d').scale(dpr, dpr);
        return { w: displayWidth, h: displayHeight };
    }

    // ========== GAME 3: EMPLATADO ==========
    const EMPLATADO_FASES = ['INESTABILIDAD', 'COLISIÓN', 'ACCIÓN', 'TRANSFORMACIÓN', 'REEQUILIBRIO'];
    const EMPLATADO_TYPES = ['salsa', 'hoja', 'proteína'];
    let emplatado = null;

    function drawEmplatadoElement(ctx, item) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle + 0.35);
        if (item.type === 'salsa') {
            ctx.globalAlpha = 0.72;
            ctx.fillStyle = GAME_PALETTE.fawn;
            [[-7, 3, 7], [0, -1, 8], [8, -3, 6]].forEach(p => {
                ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, Math.PI * 2); ctx.fill();
            });
        } else if (item.type === 'hoja') {
            ctx.fillStyle = GAME_PALETTE.olive;
            ctx.beginPath(); ctx.ellipse(-4, 0, 8, 4, -0.45, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(5, -2, 7, 3.5, 0.45, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = GAME_PALETTE.walnut; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(10, -5); ctx.stroke();
        } else {
            ctx.fillStyle = GAME_PALETTE.walnut;
            ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-4, -10); ctx.lineTo(9, -7);
            ctx.lineTo(12, 4); ctx.lineTo(3, 10); ctx.lineTo(-9, 6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = GAME_PALETTE.goldLight;
            ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(8, -6); ctx.lineTo(5, 0); ctx.lineTo(-7, 1); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    function drawEmplatado() {
        const s = emplatado, ctx = emplatadoCtx;
        ctx.fillStyle = GAME_PALETTE.dark; ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = GAME_PALETTE.cream;
        ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.globalAlpha = 0.82; ctx.fillStyle = GAME_PALETTE.cream;
        ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r - 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        s.drops.forEach(item => drawEmplatadoElement(ctx, item));
        ctx.fillStyle = GAME_PALETTE.goldLight; ctx.font = 'bold 11px Space Grotesk, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(EMPLATADO_FASES[Math.min(s.drops.length, 4)], s.w / 2, 17);
        if (!s.summary) {
            const pulse = prefersReducedMotion ? 1 : 1 + Math.sin(s.t * 0.12) * 0.2;
            ctx.strokeStyle = GAME_PALETTE.fuel; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(s.cursor.x, s.cursor.y, 7 * pulse, 0, Math.PI * 2); ctx.stroke();
        }
    }

    function emplatadoLoop() {
        if (!emplatadoActive || !emplatado) return;
        const s = emplatado;
        if (!s.summary) {
            s.t += prefersReducedMotion ? 0.5 : 1;
            s.angle += prefersReducedMotion ? 0.0175 : 0.035;
            const radiusFactor = 0.15 + 0.45 * (1 + Math.sin(s.t * 0.045));
            s.cursor = { x: s.cx + Math.cos(s.angle) * s.r * radiusFactor, y: s.cy + Math.sin(s.angle) * s.r * radiusFactor };
        }
        drawEmplatado();
        emplatadoAnimationId = requestAnimationFrame(emplatadoLoop);
    }

    function startEmplatadoPlate(plate) {
        const size = sizeGameCanvas(emplatadoCanvas);
        emplatado.plate = plate; emplatado.w = size.w; emplatado.h = size.h;
        emplatado.cx = size.w / 2; emplatado.cy = size.h / 2 + 7;
        emplatado.r = Math.min(size.w, size.h) * 0.38;
        emplatado.drops = []; emplatado.plateScore = 0; emplatado.summary = false;
        emplatado.angle = -Math.PI / 2; emplatado.t = 0;
        emplatado.cursor = { x: emplatado.cx, y: emplatado.cy - emplatado.r * 0.6 };
        contextText.textContent = 'EMPLATADO · ' + EMPLATADO_FASES[0];
        scoreText.textContent = `Plato ${plate}/3 · Puntos: ${emplatado.total}`;
        messageText.textContent = `Elemento: ${EMPLATADO_TYPES[emplatado.typeIndex].toUpperCase()}`;
        cancelAnimationFrame(emplatadoAnimationId);
        emplatadoAnimationId = requestAnimationFrame(emplatadoLoop);
    }

    function dropEmplatadoElement() {
        const s = emplatado;
        if (!emplatadoActive || !s || s.summary || s.drops.length >= 5) return;
        const dx = s.cursor.x - s.cx, dy = s.cursor.y - s.cy;
        const d = Math.hypot(dx, dy) / s.r, angle = Math.atan2(dy, dx);
        const previous = s.drops[s.drops.length - 1];
        let points = 0, feedback;
        if (d > 1) feedback = '¡AL SUELO!';
        else if (d < 0.18) { points = 10; feedback = 'DEMASIADO PERFECTO…'; }
        else if (d <= 0.85) {
            points = 30; feedback = '¡Buen pulso!';
            if (previous) {
                const gap = Math.abs(Math.atan2(Math.sin(angle - previous.angle), Math.cos(angle - previous.angle)));
                if (gap >= 40 * Math.PI / 180) { points += 15; feedback = '¡Composición!'; }
            }
        } else { points = 20; feedback = 'Al borde — atrevido'; }
        s.drops.push({ x: s.cursor.x, y: s.cursor.y, angle, type: EMPLATADO_TYPES[s.typeIndex] });
        s.plateScore += points; s.total += points; playChopSound();
        contextText.textContent = 'EMPLATADO · ' + EMPLATADO_FASES[Math.min(s.drops.length, 4)];
        scoreText.textContent = `Plato ${s.plate}/3 · Puntos: ${s.total}`;
        messageText.textContent = feedback + ` +${points}`;
        if (s.drops.length === 5) finishEmplatadoPlate();
    }

    function finishEmplatadoPlate() {
        const s = emplatado;
        s.summary = true;
        if (new Set(s.drops.map(item => item.type)).size === 3) {
            s.plateScore += 25; s.total += 25; messageText.textContent = '¡Variedad! +25';
        }
        const verdict = s.plateScore >= 180 ? '¡MEMORABLE!' : s.plateScore >= 130 ? '¡CON CARÁCTER!' : s.plateScore >= 80 ? 'CORRECTO' : 'MUY TÍMIDO…';
        contextText.textContent = `PLATO ${s.plate} · ${verdict}`;
        scoreText.textContent = `Plato: ${s.plateScore} · Total: ${s.total}`;
        messageText.innerHTML += `<br>${verdict}`; playGameStartSound();
        const session = s.session;
        setTimeout(() => {
            if (session !== gameSessionToken || !emplatadoActive) return;
            if (s.plate === 3) endEmplatadoGame(); else startEmplatadoPlate(s.plate + 1);
        }, 2000);
    }

    function swapEmplatadoType() {
        if (!emplatadoActive || !emplatado || emplatado.summary) return;
        emplatado.typeIndex = (emplatado.typeIndex + 1) % EMPLATADO_TYPES.length;
        messageText.textContent = `Elemento: ${EMPLATADO_TYPES[emplatado.typeIndex].toUpperCase()}`;
        playButtonSound();
    }

    function endEmplatadoGame() {
        const total = emplatado.total;
        emplatadoActive = false; gameActive = false; cancelAnimationFrame(emplatadoAnimationId); playSnakeLoseSound();
        const grade = total >= 500 ? '¡CHEF ARTISTA!' : total >= 380 ? '¡EMPLATADOR AUDAZ!' : total >= 250 ? '¡BUEN OJO!' : '¡SIGUE JUGANDO!';
        contextText.textContent = '¡Juego Terminado!'; scoreText.textContent = `Puntos: ${total}`;
        messageText.innerHTML = `${grade}<br>Jugar de Nuevo: EMPLATADO + A/B`;
    }

    async function initializeEmplatadoSession() {
        if (currentMenuIndex !== GAME3_INDEX) return;
        if (gameActive || snakeGameActive || emplatadoActive || equilibrioActive || bootInProgress) return;
        const session = ++gameSessionToken;
        bootInProgress = true;
        await playStartupAnimation();
        bootInProgress = false;
        if (session !== gameSessionToken) return;
        gameActive = true;
        if (emplatadoPreview) emplatadoPreview.classList.remove('active');
        if (gameContainer) gameContainer.style.display = 'flex';
        gameInfoWrapper.classList.remove('active');
        contextText.innerHTML = "<span style='font-size: clamp(12px, 2.5vw, 16px); font-weight: bold;'>EMPLATADO</span>";
        scoreText.innerHTML = "<span style='font-size: clamp(6px, 1vw, 8px); opacity: 0.7; font-style: italic;'>Lo memorable nunca es perfecto</span>";
        messageText.innerHTML = 'Coloca 5 elementos<br>A: colocar · B: cambiar elemento<br><br>¡Prepárate!';
        playGameStartSound();
        if (emplatadoCanvas) emplatadoCanvas.style.display = 'none';
        setTimeout(() => {
            if (session !== gameSessionToken) return;
            gameInfoWrapper.classList.add('active');
            emplatadoCanvas.style.display = 'block';
            emplatado = { session, plate: 1, total: 0, typeIndex: 0, drops: [] };
            emplatadoActive = true; startEmplatadoPlate(1);
        }, 2500);
    }

    // ========== GAME 4: EQUILIBRIO ==========
    const EQUILIBRIO_COLORS = [GAME_PALETTE.fuel, GAME_PALETTE.goldLight, GAME_PALETTE.fawn, GAME_PALETTE.olive];
    let equilibrio = null;

    function drawEquilibrioItem(ctx, item, scale) {
        ctx.save(); ctx.translate(item.x, item.y); ctx.scale(scale, scale);
        ctx.fillStyle = item.color; ctx.strokeStyle = item.color; ctx.lineWidth = 3;
        if (item.type === 0) { ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); }
        else if (item.type === 1) { ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, -0.3, 0, Math.PI * 2); ctx.fill(); }
        else if (item.type === 2) { ctx.beginPath(); ctx.arc(0, -4, 11, 0.2, 2.8); ctx.stroke(); }
        else { ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0.55, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }

    function drawEquilibrio() {
        const s = equilibrio, ctx = equilibrioCtx, gaugeX = 28, gaugeY = 25, gaugeW = s.w - 56;
        ctx.fillStyle = GAME_PALETTE.dark; ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = GAME_PALETTE.fawn; ctx.font = 'bold 9px Space Grotesk, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('CAOS', gaugeX, 13);
        ctx.fillStyle = GAME_PALETTE.cream; ctx.textAlign = 'right'; ctx.fillText('ORDEN', gaugeX + gaugeW, 13);
        ctx.fillStyle = GAME_PALETTE.walnut; ctx.fillRect(gaugeX, gaugeY, gaugeW, 6);
        ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = GAME_PALETTE.goldLight; ctx.fillRect(gaugeX + gaugeW * 0.4, gaugeY - 2, gaugeW * 0.2, 10); ctx.restore();
        ctx.fillStyle = GAME_PALETTE.goldLight; ctx.textAlign = 'center'; ctx.fillText('✳', gaugeX + gaugeW * 0.5, gaugeY + 6);
        ctx.fillStyle = GAME_PALETTE.fuel; ctx.beginPath();
        const needleX = gaugeX + gaugeW * s.needle; ctx.moveTo(needleX, gaugeY + 13); ctx.lineTo(needleX - 4, gaugeY + 7); ctx.lineTo(needleX + 4, gaugeY + 7); ctx.fill();
        s.splats.forEach(splat => splat.points.forEach(p => {
            ctx.fillStyle = splat.color; ctx.beginPath(); ctx.arc(splat.x + p.x, s.floorY + p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }));
        s.items.forEach(item => drawEquilibrioItem(ctx, item, item.pop ? 1 + (3 - item.pop) * 0.25 : 1));
        ctx.fillStyle = GAME_PALETTE.walnut; ctx.fillRect(0, s.floorY, s.w, 6);
        ctx.fillStyle = GAME_PALETTE.cream; ctx.beginPath(); ctx.roundRect(s.playerX, s.trayY, s.trayW, 10, 5); ctx.fill();
    }

    function spawnEquilibrioItem(progress) {
        const s = equilibrio, type = s.spawned++ % 4;
        s.items.push({ type, color: EQUILIBRIO_COLORS[type], x: 14 + Math.random() * (s.w - 28), y: 44,
            speed: 45 + progress * 35 + Math.random() * 10, wobbleFreq: 0.002 + Math.random() * 0.002, phase: Math.random() * Math.PI * 2, pop: 0 });
    }

    function addEquilibrioSplat(item) {
        equilibrio.splats.push({ x: item.x, color: item.color, points: Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({
            x: (Math.random() - 0.5) * 16, y: -Math.random() * 4, r: 2 + Math.random() * 3
        })) });
    }

    function updateEquilibrioHud(timestamp, remaining, balance, judged) {
        const s = equilibrio, seconds = Math.max(0, Math.ceil(remaining / 1000));
        scoreText.textContent = `Balance: ${s.score} · 0:${String(seconds).padStart(2, '0')}`;
        if (timestamp - s.lastMessage < 1000) return;
        s.lastMessage = timestamp;
        if (!judged || (balance >= 0.4 && balance <= 0.6)) messageText.textContent = 'EN EL PUNTO PRESUNTA';
        else messageText.textContent = balance > 0.6 ? 'demasiado orden…' : 'demasiado caos…';
    }

    function equilibrioLoop(timestamp) {
        if (!equilibrioActive || !equilibrio) return;
        const s = equilibrio;
        if (!s.startTime) { s.startTime = timestamp; s.lastTime = timestamp; s.lastSpawn = timestamp; s.lastScore = timestamp; }
        const dt = Math.min(0.04, (timestamp - s.lastTime) / 1000), elapsed = timestamp - s.startTime, remaining = 60000 - elapsed;
        if (remaining <= 0) { endEquilibrioGame(); return; }
        const progress = Math.min(1, elapsed / 60000), spawnEvery = 900 - progress * 450;
        if (timestamp - s.lastSpawn >= spawnEvery) { spawnEquilibrioItem(progress); s.lastSpawn = timestamp; }
        const velocity = s.w * 0.65 * dt;
        if (equilibrioKeys.has('arrowleft')) s.playerX -= velocity;
        if (equilibrioKeys.has('arrowright')) s.playerX += velocity;
        s.playerX = Math.max(0, Math.min(s.w - s.trayW, s.playerX));
        s.items.forEach(item => {
            if (item.pop) { item.pop--; return; }
            item.y += item.speed * dt;
            if (!prefersReducedMotion) item.x += Math.sin(timestamp * item.wobbleFreq + item.phase) * 0.6;
            if (item.y + 7 >= s.trayY && item.y < s.trayY + 10 && item.x >= s.playerX && item.x <= s.playerX + s.trayW) {
                item.pop = 2; item.caught = true; s.orden++; playChopSound();
            } else if (item.y + 7 >= s.floorY) {
                item.missed = true; s.caos++; addEquilibrioSplat(item);
            }
        });
        s.items = s.items.filter(item => !item.missed && !(item.caught && item.pop === 0));
        const total = s.orden + s.caos, judged = total >= 3;
        const balance = judged ? s.orden / Math.max(1, total) : 0.5;
        s.needle += (balance - s.needle) * 0.1;
        if (judged && balance >= 0.4 && balance <= 0.6) {
            while (timestamp - s.lastScore >= 500) { s.score++; s.lastScore += 500; }
        } else s.lastScore = timestamp;
        updateEquilibrioHud(timestamp, remaining, balance, judged); drawEquilibrio();
        s.lastTime = timestamp; equilibrioAnimationId = requestAnimationFrame(equilibrioLoop);
    }

    function stepEquilibrio(direction) {
        if (!equilibrioActive || !equilibrio) return;
        equilibrio.playerX = Math.max(0, Math.min(equilibrio.w - equilibrio.trayW, equilibrio.playerX + direction * equilibrio.w * 0.12));
        playButtonSound();
    }

    function endEquilibrioGame() {
        const score = equilibrio.score;
        equilibrioActive = false; gameActive = false; equilibrioKeys.clear(); cancelAnimationFrame(equilibrioAnimationId); playSnakeLoseSound();
        const grade = score >= 80 ? 'MAESTRO DEL EQUILIBRIO' : score >= 50 ? 'PRESUNTO EQUILIBRISTA' : score >= 25 ? 'APRENDIZ DEL CAOS' : 'TODO ORDEN O TODO CAOS';
        contextText.textContent = '¡Juego Terminado!'; scoreText.textContent = `Balance: ${score}`;
        messageText.innerHTML = `${grade}<br>El punto justo entre orden y caos<br>Jugar de Nuevo: EQUILIBRIO + A/B`;
    }

    async function initializeEquilibrioSession() {
        if (currentMenuIndex !== GAME4_INDEX) return;
        if (gameActive || snakeGameActive || emplatadoActive || equilibrioActive || bootInProgress) return;
        const session = ++gameSessionToken;
        bootInProgress = true;
        await playStartupAnimation();
        bootInProgress = false;
        if (session !== gameSessionToken) return;
        gameActive = true;
        if (equilibrioPreview) equilibrioPreview.classList.remove('active');
        if (gameContainer) gameContainer.style.display = 'flex';
        gameInfoWrapper.classList.remove('active');
        contextText.innerHTML = "<span style='font-size: clamp(12px, 2.5vw, 16px); font-weight: bold;'>EQUILIBRIO</span>";
        scoreText.innerHTML = "<span style='font-size: clamp(6px, 1vw, 8px); opacity: 0.7; font-style: italic;'>Ni orden ni caos</span>";
        messageText.innerHTML = 'Atrapa lo justo y deja caer el resto<br>Flechas o A/B: mover bandeja<br><br>¡Prepárate!';
        playGameStartSound();
        if (equilibrioCanvas) equilibrioCanvas.style.display = 'none';
        setTimeout(() => {
            if (session !== gameSessionToken) return;
            gameInfoWrapper.classList.add('active'); equilibrioCanvas.style.display = 'block';
            const size = sizeGameCanvas(equilibrioCanvas), trayW = size.w * 0.22;
            equilibrio = { session, w: size.w, h: size.h, floorY: size.h - 8, trayY: size.h - 24, trayW,
                playerX: (size.w - trayW) / 2, items: [], splats: [], orden: 0, caos: 0, needle: 0.5,
                score: 0, spawned: 0, startTime: 0, lastTime: 0, lastSpawn: 0, lastScore: 0, lastMessage: 0 };
            equilibrioKeys.clear(); equilibrioActive = true;
            equilibrioAnimationId = requestAnimationFrame(equilibrioLoop);
        }, 2500);
    }

    function handleButtonA() {
        // Control video play/pause when on VIDEO tab
        if (currentMenuIndex === VIDEO_INDEX) {
            if (videoElement) {
                if (videoElement.paused || videoElement.ended) {
                    // Play console start sound when starting video
                    playStartupSound();
                    videoElement.play().catch(err => console.log('Video play failed:', err));
                } else {
                    // No sound when pausing
                    videoElement.pause();
                }
            }
            return;
        }

        if (currentMenuIndex === GALLERY_INDEX) return;

        if (currentMenuIndex === RESERVAR_INDEX) {
            playButtonSound();
            const trigger = document.querySelector('[data-modal-open="modal-1"]');
            if (trigger) trigger.click();
            return;
        }
        if (currentMenuIndex === SETTINGS_INDEX) {
            soundEnabled = !soundEnabled;
            localStorage.setItem('pe-sound', soundEnabled ? '1' : '0');
            if (soundEnabled) playButtonSound();
            updateMenuSelectionDisplay();
            return;
        }
        if (currentMenuIndex === ENTROPY_INDEX) {
            playButtonSound();
            if (window.__peEntropy && typeof window.__peEntropy.toggle === 'function') {
                window.__peEntropy.toggle();
            } else {
                localStorage.setItem('pe-entropy', localStorage.getItem('pe-entropy') === '1' ? '0' : '1');
            }
            updateMenuSelectionDisplay();
            return;
        }

        // Start game if not active - no sound, just start
        if (!gameActive) {
            if (currentMenuIndex === GAME1_INDEX) {
                initializeGameSession();
            } else if (currentMenuIndex === GAME2_INDEX) {
                initializeSnakeSession();
            } else if (currentMenuIndex === GAME3_INDEX) {
                initializeEmplatadoSession();
            } else if (currentMenuIndex === GAME4_INDEX) {
                initializeEquilibrioSession();
            }
            return;
        }

        // Game-specific controls when active (sounds handled by game logic)
        if (currentMenuIndex === GAME1_INDEX && !roundOver) {
            recordSlice(); // Plays chop sound internally
        } else if (currentMenuIndex === GAME2_INDEX && snakeGameActive) {
            // Button A: Turn clockwise (right/down) - sound handled by rotateSnakeDirection
            rotateSnakeDirection(true);
        } else if (currentMenuIndex === GAME3_INDEX && emplatadoActive) {
            dropEmplatadoElement();
        } else if (currentMenuIndex === GAME4_INDEX && equilibrioActive) {
            stepEquilibrio(-1);
        }
    }

    function handleButtonB() {
        // Control video play/pause when on VIDEO tab
        if (currentMenuIndex === VIDEO_INDEX) {
            if (videoElement) {
                if (videoElement.paused || videoElement.ended) {
                    // Play console start sound when starting video
                    playStartupSound();
                    videoElement.play().catch(err => console.log('Video play failed:', err));
                } else {
                    // No sound when pausing
                    videoElement.pause();
                }
            }
            return;
        }

        if (currentMenuIndex === GALLERY_INDEX) return;

        if (currentMenuIndex === RESERVAR_INDEX) {
            playButtonSound();
            const trigger = document.querySelector('[data-modal-open="modal-1"]');
            if (trigger) trigger.click();
            return;
        }
        if (currentMenuIndex === SETTINGS_INDEX) {
            playButtonSound();
            const newTheme = localStorage.getItem('pe-theme') === 'light' ? 'dark' : 'light';
            localStorage.setItem('pe-theme', newTheme);
            if (typeof window.__peSetTheme === 'function') window.__peSetTheme(newTheme);
            updateMenuSelectionDisplay();
            return;
        }
        if (currentMenuIndex === ENTROPY_INDEX) {
            playButtonSound();
            if (window.__peEntropy && typeof window.__peEntropy.toggle === 'function') {
                window.__peEntropy.toggle();
            } else {
                localStorage.setItem('pe-entropy', localStorage.getItem('pe-entropy') === '1' ? '0' : '1');
            }
            updateMenuSelectionDisplay();
            return;
        }

        const currentTime = Date.now();

        // Double-click B to abort GAME 1
        if (gameActive && currentMenuIndex === GAME1_INDEX && (currentTime - lastBPressTime) < DOUBLE_CLICK_B_TIMEOUT) {
            endGameSession("¡Juego Cancelado! Jugar de Nuevo: SLICER + A/B");
            lastBPressTime = 0;
            return;
        }

        lastBPressTime = currentTime;

        // Start game if not active - no sound, just start
        if (!gameActive) {
            if (currentMenuIndex === GAME1_INDEX) {
                initializeGameSession();
            } else if (currentMenuIndex === GAME2_INDEX) {
                initializeSnakeSession();
            } else if (currentMenuIndex === GAME3_INDEX) {
                initializeEmplatadoSession();
            } else if (currentMenuIndex === GAME4_INDEX) {
                initializeEquilibrioSession();
            }
            return;
        }

        // Game-specific controls when active (sounds handled by game logic)
        if (currentMenuIndex === GAME1_INDEX && !roundOver) {
            finalizeSlicing(); // No sound needed for finalize
        } else if (currentMenuIndex === GAME2_INDEX && snakeGameActive) {
            // Button B: Turn counter-clockwise (left/up) - sound handled by rotateSnakeDirection
            rotateSnakeDirection(false);
        } else if (currentMenuIndex === GAME3_INDEX && emplatadoActive) {
            swapEmplatadoType();
        } else if (currentMenuIndex === GAME4_INDEX && equilibrioActive) {
            stepEquilibrio(1);
        }
    }

    // Button visual feedback
    buttonA.addEventListener('mousedown', () => {
        buttonA.querySelector('svg').innerHTML = document.getElementById('btn-a-down').innerHTML;
    });
    buttonA.addEventListener('mouseup', () => {
        buttonA.querySelector('svg').innerHTML = `
            <rect fill="#442b26" y="7.45" width="106.44" height="106.44" rx="27.18" ry="27.18"/>
            <rect fill="#b2a79d" x="6.22" y="13.67" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#e8d5c4" x="6.22" width="93.99" height="93.99" rx="24" ry="24"/>
            <circle fill="#c6baaf" cx="53.22" cy="46.99" r="27.51"/>
        `;
    });
    buttonA.addEventListener('mouseleave', () => {
        buttonA.querySelector('svg').innerHTML = `
            <rect fill="#442b26" y="7.45" width="106.44" height="106.44" rx="27.18" ry="27.18"/>
            <rect fill="#b2a79d" x="6.22" y="13.67" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#e8d5c4" x="6.22" width="93.99" height="93.99" rx="24" ry="24"/>
            <circle fill="#c6baaf" cx="53.22" cy="46.99" r="27.51"/>
        `;
    });

    buttonB.addEventListener('mousedown', () => {
        buttonB.querySelector('svg').innerHTML = document.getElementById('btn-b-down').innerHTML;
    });
    buttonB.addEventListener('mouseup', () => {
        buttonB.querySelector('svg').innerHTML = `
            <rect fill="#442b26" y="7.45" width="106.44" height="106.44" rx="27.18" ry="27.18"/>
            <rect fill="#d1892a" x="6.22" y="13.67" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#efa02e" x="6.22" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#d1892a" x="28.78" y="22.56" width="48.88" height="48.88" rx="12.48" ry="12.48"/>
        `;
    });
    buttonB.addEventListener('mouseleave', () => {
        buttonB.querySelector('svg').innerHTML = `
            <rect fill="#442b26" y="7.45" width="106.44" height="106.44" rx="27.18" ry="27.18"/>
            <rect fill="#d1892a" x="6.22" y="13.67" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#efa02e" x="6.22" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#d1892a" x="28.78" y="22.56" width="48.88" height="48.88" rx="12.48" ry="12.48"/>
        `;
    });

    buttonA.addEventListener('click', handleButtonA);
    buttonB.addEventListener('click', handleButtonB);

    buttonA.addEventListener('touchstart', (e) => {
        e.preventDefault();
        buttonA.querySelector('svg').innerHTML = document.getElementById('btn-a-down').innerHTML;
        handleButtonA();
    });
    buttonA.addEventListener('touchend', (e) => {
        e.preventDefault();
        buttonA.querySelector('svg').innerHTML = `
            <rect fill="#442b26" y="7.45" width="106.44" height="106.44" rx="27.18" ry="27.18"/>
            <rect fill="#b2a79d" x="6.22" y="13.67" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#e8d5c4" x="6.22" width="93.99" height="93.99" rx="24" ry="24"/>
            <circle fill="#c6baaf" cx="53.22" cy="46.99" r="27.51"/>
        `;
    });
    buttonB.addEventListener('touchstart', (e) => {
        e.preventDefault();
        buttonB.querySelector('svg').innerHTML = document.getElementById('btn-b-down').innerHTML;
        handleButtonB();
    });
    buttonB.addEventListener('touchend', (e) => {
        e.preventDefault();
        buttonB.querySelector('svg').innerHTML = `
            <rect fill="#442b26" y="7.45" width="106.44" height="106.44" rx="27.18" ry="27.18"/>
            <rect fill="#d1892a" x="6.22" y="13.67" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#efa02e" x="6.22" width="93.99" height="93.99" rx="24" ry="24"/>
            <rect fill="#d1892a" x="28.78" y="22.56" width="48.88" height="48.88" rx="12.48" ry="12.48"/>
        `;
    });

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();

        // Never intercept keys when user is typing in a form element
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.isContentEditable
        );

        if (isTyping) {
            return; // Let the form handle the input
        }

        // Only handle gameboy controls when:
        // 1. Hovering over the gameboy, OR
        // 2. A game is currently active (slicer or snake)
        const shouldHandleControls = isHoveringGameboy || gameActive || snakeGameActive || emplatadoActive || equilibrioActive;

        // Arrow keys for menu navigation - only when hovering (not during active gameplay elsewhere)
        const isArrowKey = key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright';

        // Block scrolling when hovering over gameboy and using arrow keys
        if (isHoveringGameboy && isArrowKey) {
            e.preventDefault();
        }

        // Don't process non-arrow game controls unless hovering or game is active
        if (!shouldHandleControls && !isArrowKey) {
            return;
        }

        switch(key) {
            case 'q':
            case 'a':
            case 'z':
            case ' ':
                if (!shouldHandleControls) return;
                e.preventDefault();
                handleButtonA();
                break;
            case 'e':
            case 'b':
            case 'x':
            case 'enter':
                if (!shouldHandleControls) return;
                e.preventDefault();
                handleButtonB();
                break;
            case 'arrowup':
            case 'w':
                if (snakeGameActive) {
                    e.preventDefault();
                    // Control snake direction - validate to prevent opposite direction
                    if (isValidDirection('up')) {
                        snakeDirection = 'up';
                        // Play snake move sound
                        playSnakeMoveSound();
                    }
                } else if (!gameActive && isHoveringGameboy) {
                    e.preventDefault();
                    // Navigate menu only when no game is active AND hovering
                    flashSwitchPose(-1);
                    playButtonSound();
                    currentMenuIndex = (currentMenuIndex - 1 + menuButtons.length) % menuButtons.length;
                    updateMenuSelectionDisplay();
                }
                // If gameActive but not snakeGameActive (slicer is active), arrows do nothing
                break;
            case 'arrowdown':
            case 's':
                if (snakeGameActive) {
                    e.preventDefault();
                    // Control snake direction - validate to prevent opposite direction
                    if (isValidDirection('down')) {
                        snakeDirection = 'down';
                        // Play snake move sound
                        playSnakeMoveSound();
                    }
                } else if (!gameActive && isHoveringGameboy) {
                    e.preventDefault();
                    // Navigate menu only when no game is active AND hovering
                    flashSwitchPose(1);
                    playButtonSound();
                    currentMenuIndex = (currentMenuIndex + 1) % menuButtons.length;
                    updateMenuSelectionDisplay();
                }
                // If gameActive but not snakeGameActive (slicer is active), arrows do nothing
                break;
            case 'arrowleft':
                if (equilibrioActive) {
                    e.preventDefault();
                    equilibrioKeys.add('arrowleft');
                } else if (snakeGameActive) {
                    e.preventDefault();
                    // Control snake direction - validate to prevent opposite direction
                    if (isValidDirection('left')) {
                        snakeDirection = 'left';
                        // Play snake move sound
                        playSnakeMoveSound();
                    }
                }
                break;
            case 'arrowright':
                if (equilibrioActive) {
                    e.preventDefault();
                    equilibrioKeys.add('arrowright');
                } else if (snakeGameActive) {
                    e.preventDefault();
                    // Control snake direction - validate to prevent opposite direction
                    if (isValidDirection('right')) {
                        snakeDirection = 'right';
                        // Play snake move sound
                        playSnakeMoveSound();
                    }
                }
                break;
            case 'h':
            case 'f1':
                if (!shouldHandleControls) return;
                e.preventDefault();
                showHelp();
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'arrowleft' || key === 'arrowright') equilibrioKeys.delete(key);
    });

    // Add hover detection for scroll blocking
    const gameboyWrapper = document.querySelector('.presunta-game-wrapper');
    if (gameboyWrapper) {
        gameboyWrapper.addEventListener('mouseenter', () => {
            isHoveringGameboy = true;
        });

        gameboyWrapper.addEventListener('mouseleave', () => {
            isHoveringGameboy = false;
        });
    }

    // SVG icon strings for play and pause
    const playIconSVG = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7L8 5z" fill="var(--pe-fuel-yellow)" stroke="var(--pe-fuel-yellow)" stroke-width="1"/></svg>';
    const pauseIconSVG = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="var(--pe-fuel-yellow)" stroke="var(--pe-fuel-yellow)" stroke-width="1"/></svg>';

    // Video controls state
    let videoControlsVisible = false;
    let hideControlsTimeout = null;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Helper to show all video controls
    function showVideoControls() {
        videoControlsVisible = true;
        if (centerPlayIcon) centerPlayIcon.style.opacity = '1';
        if (volumeControl) volumeControl.style.display = 'flex';
        if (fullscreenControl) fullscreenControl.style.display = 'flex';

        // Auto-hide after 3 seconds
        if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
        hideControlsTimeout = setTimeout(() => {
            if (!videoElement.paused) {
                hideVideoControls();
            }
        }, 3000);
    }

    // Helper to hide video controls
    function hideVideoControls() {
        videoControlsVisible = false;
        if (!videoElement.paused && centerPlayIcon) {
            centerPlayIcon.style.opacity = '0';
        }
        if (volumeControl) volumeControl.style.display = 'none';
        if (fullscreenControl) fullscreenControl.style.display = 'none';
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (videoElement.readyState < 2) {
            console.log('Video not ready yet');
            return;
        }

        if (videoElement.paused || videoElement.ended) {
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.log('Play failed:', err);
                });
            }
        } else {
            videoElement.pause();
        }
    }

    // Center play/pause icon and video container interaction handler
    if (centerPlayIcon && videoElement && videoPlayerContainer) {
        // Desktop: Click to play/pause directly
        // Mobile: First tap shows controls, second tap on play button plays/pauses

        const handleVideoInteraction = (e) => {
            // Prevent triggering when clicking on corner controls
            if (e.target.closest('#volume-control') || e.target.closest('#fullscreen-control')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (isTouchDevice) {
                // Mobile behavior
                if (videoElement.paused || videoElement.ended) {
                    // If paused, tap anywhere plays
                    togglePlayPause();
                } else {
                    // If playing, first tap shows controls
                    if (!videoControlsVisible) {
                        showVideoControls();
                    } else {
                        // If controls visible, tap outside buttons hides them
                        if (!e.target.closest('#center-play-icon')) {
                            hideVideoControls();
                        }
                    }
                }
            } else {
                // Desktop behavior - click toggles play/pause
                togglePlayPause();
            }
        };

        // Track if touch event was handled to prevent double-firing
        let touchHandled = false;

        // Center play icon handler
        const handleCenterPlayClick = (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Skip if touch already handled this
            if (touchHandled) {
                touchHandled = false;
                return;
            }

            togglePlayPause();
            if (isTouchDevice && !videoElement.paused) {
                showVideoControls();
            }
        };

        centerPlayIcon.addEventListener('click', handleCenterPlayClick);

        centerPlayIcon.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });

        centerPlayIcon.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            touchHandled = true;
            togglePlayPause();
            if (!videoElement.paused) {
                showVideoControls();
            }
        });

        // Video container handler
        const handleContainerClick = (e) => {
            if (touchHandled) {
                touchHandled = false;
                return;
            }
            handleVideoInteraction(e);
        };

        videoPlayerContainer.addEventListener('click', handleContainerClick);

        videoPlayerContainer.addEventListener('touchstart', () => {
            // Allow touch to propagate but mark it
        }, { passive: true });

        videoPlayerContainer.addEventListener('touchend', (e) => {
            // Prevent click from also firing
            touchHandled = true;
            handleVideoInteraction(e);
        });
    }

    // Video element event listeners
    if (videoElement) {
        videoElement.addEventListener('play', () => {
            if (centerPlayIcon) {
                centerPlayIcon.innerHTML = pauseIconSVG;
                // On mobile, show controls briefly then hide
                if (isTouchDevice) {
                    showVideoControls();
                } else {
                    // Desktop: hide after short delay
                    setTimeout(() => {
                        centerPlayIcon.style.opacity = '0';
                    }, 500);
                }
            }
            if (videoOverlay) videoOverlay.style.display = 'none';
        });

        videoElement.addEventListener('pause', () => {
            if (centerPlayIcon) {
                centerPlayIcon.innerHTML = playIconSVG;
                centerPlayIcon.style.opacity = '1';
            }
            // Show controls when paused
            videoControlsVisible = true;
            if (volumeControl) volumeControl.style.display = 'flex';
            if (fullscreenControl) fullscreenControl.style.display = 'flex';
        });

        videoElement.addEventListener('ended', () => {
            if (centerPlayIcon) {
                centerPlayIcon.innerHTML = playIconSVG;
                centerPlayIcon.style.opacity = '1';
            }
            if (videoOverlay) videoOverlay.style.display = 'block';
            videoControlsVisible = true;
        });
    }

    // Volume control
    if (volumeControl && videoElement && volumeIcon) {
        const volumeOnSVG = '<svg id="volume-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="var(--pe-fuel-yellow)"/></svg>';
        const volumeOffSVG = '<svg id="volume-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="var(--pe-fuel-yellow)"/></svg>';

        const handleVolumeToggle = (e) => {
            e.stopPropagation();
            e.preventDefault();
            videoElement.muted = !videoElement.muted;
            volumeControl.innerHTML = videoElement.muted ? volumeOffSVG : volumeOnSVG;
            // Reset hide timeout
            if (isTouchDevice) showVideoControls();
        };

        volumeControl.addEventListener('click', handleVolumeToggle);
        volumeControl.addEventListener('touchend', handleVolumeToggle);
    }

    // Mouse movement to show/hide corner controls (desktop only)
    if (videoPlayerContainer && !isTouchDevice) {
        videoPlayerContainer.addEventListener('mousemove', (e) => {
            const rect = videoPlayerContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Show volume control in top left corner (within 100px from top-left)
            if (volumeControl) {
                if (x < 100 && y < 100) {
                    volumeControl.style.display = 'flex';
                } else {
                    volumeControl.style.display = 'none';
                }
            }

            // Show fullscreen control in top right corner (within 100px from top-right)
            if (fullscreenControl) {
                if (x > rect.width - 100 && y < 100) {
                    fullscreenControl.style.display = 'flex';
                } else {
                    fullscreenControl.style.display = 'none';
                }
            }

            // Clear existing timeout
            if (hideControlsTimeout) {
                clearTimeout(hideControlsTimeout);
            }

            // Hide controls after 2 seconds of no movement
            hideControlsTimeout = setTimeout(() => {
                if (volumeControl) volumeControl.style.display = 'none';
                if (fullscreenControl) fullscreenControl.style.display = 'none';
            }, 2000);
        });

        videoPlayerContainer.addEventListener('mouseleave', () => {
            if (volumeControl) volumeControl.style.display = 'none';
            if (fullscreenControl) fullscreenControl.style.display = 'none';
        });
    }

    // Fullscreen control - with mobile/iOS support
    function toggleFullScreen() {
        // Check if already fullscreen
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

        if (!isFullscreen) {
            // Try video element first (better for mobile/iOS)
            const element = videoElement || videoPlayerContainer;

            if (element.requestFullscreen) {
                element.requestFullscreen().catch(err => {
                    console.log(`Fullscreen error: ${err.message}`);
                });
            } else if (element.webkitRequestFullscreen) {
                // Safari/iOS
                element.webkitRequestFullscreen();
            } else if (element.webkitEnterFullscreen) {
                // iOS video specific
                element.webkitEnterFullscreen();
            } else if (element.mozRequestFullScreen) {
                // Firefox
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                // IE/Edge
                element.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    if (fullscreenControl) {
        const handleFullscreenToggle = (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFullScreen();
            // Reset hide timeout on mobile
            if (isTouchDevice) showVideoControls();
        };

        fullscreenControl.addEventListener('click', handleFullscreenToggle);
        fullscreenControl.addEventListener('touchend', handleFullscreenToggle);
    }

    function showHelp() {
        const helpText = `JUEGO DE CORTE PRESUNTA\n\nCONTROLES:\n• A/Espacio: Hacer un corte\n• B/Enter: Terminar de cortar\n• Flechas/W,S: Navegar menú\n• H/F1: Mostrar esta ayuda\n\nJUEGO:\n• Corta ingredientes en tamaños ideales\n• Diferentes ingredientes necesitan diferentes tamaños\n• Puntaje: Precisión + Velocidad + Calidad de Ancho\n• BONOS: Cortes perfectos, velocidad, eficiencia\n\nCONSEJOS:\n• Observa el número objetivo de cortes\n• Tamaños consistentes = mayor precisión\n• Menos pasadas = bono de velocidad\n• Iguala el ancho ideal para puntos de calidad`;

        alert(helpText);
    }

    // ========== PAGE STARTUP ANIMATION ==========
    // Show startup animation on page load before gallery is visible
    async function playPageStartupAnimation() {
        return new Promise((resolve) => {
            // Show dark screen immediately on page load
            if (darkScreen) darkScreen.style.display = 'block';

            // Hide gallery container during startup
            if (galleryContainer) galleryContainer.style.opacity = '0';

            // Reset logo and line
            if (startupLogo) {
                startupLogo.style.opacity = '0';
                startupLogo.classList.remove('flickering');
            }
            if (startupLine) {
                startupLine.style.width = '0';
                startupLine.style.height = '2px';
                startupLine.classList.remove('animating');
            }

            // Show black logo with flicker and play startup sound
            setTimeout(() => {
                if (startupLogo) {
                    startupLogo.style.opacity = '1';
                    startupLogo.classList.add('flickering');
                }
                // Play startup sound (needs user interaction on mobile, but works on desktop)
                playStartupSound();
            }, 100);

            // Start line animation after logo flickers
            setTimeout(() => {
                if (startupLine) startupLine.classList.add('animating');
            }, 500);

            // Fade out logo as line expands
            setTimeout(() => {
                if (startupLogo) startupLogo.style.opacity = '0';
            }, 1400);

            // Hide dark screen after animation completes and show gallery
            setTimeout(() => {
                if (darkScreen) darkScreen.style.display = 'none';
                if (startupLine) startupLine.classList.remove('animating');
                if (startupLogo) startupLogo.classList.remove('flickering');

                // Show gallery immediately (no fade transition)
                if (galleryContainer) galleryContainer.style.opacity = '1';

                resolve();
            }, 1700); // Match animation duration
        });
    }

    // Initialize with startup animation
    async function initWithStartupAnimation() {
        // Initialize gallery first (so first image is ready)
        initGallery();

        // Make sure first image is active and visible immediately (no transition)
        if (galleryImages.length > 0) {
            galleryImages[0].style.transition = 'none';
            galleryImages[0].classList.add('active');
            // Re-enable transitions after a frame
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    galleryImages[0].style.transition = '';
                });
            });
        }

        // Play startup animation
        await playPageStartupAnimation();

        // Start gallery crossfade after startup animation completes
        if (galleryImages.length > 1) {
            startGalleryCrossfade();
        }

        // Set initial menu display
        updateMenuSelectionDisplay();
    }

    // Run initialization with startup animation
    initWithStartupAnimation();

    // (Console 3D tilt removed 2026-07-17 at Juan's request — the console
    //  renders flat. The nav-switch rocker pose is unrelated and stays.)
});
