// Shared Logic - Aetheric Minimalist Portfolio

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initContactForm();
    initScrollReveal();
    initImages();
});

/* ==========================================
   1. Theme Management (Dark/Light)
   ========================================== */
function initTheme() {
    const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
    
    // Function to apply theme classes
    const applyTheme = (theme) => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
            updateToggleIcons('dark');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
            updateToggleIcons('light');
        }
    };

    // Helper to update all theme icons on the page
    const updateToggleIcons = (theme) => {
        themeToggleBtns.forEach(btn => {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) {
                if (theme === 'dark') {
                    icon.textContent = 'light_mode'; // Show sun to trigger light mode
                    icon.setAttribute('data-icon', 'light_mode');
                } else {
                    icon.textContent = 'dark_mode'; // Show moon to trigger dark mode
                    icon.setAttribute('data-icon', 'dark_mode');
                }
            }
        });
    };

    // Initial load check
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(prefersDark ? 'dark' : 'light');
    }

    // Toggle button click listeners
    themeToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    });
}

/* ==========================================
   2. Mobile Drawer Navigation Menu
   ========================================== */
function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const closeBtn = document.querySelector('.mobile-menu-close');
    const menuOverlay = document.querySelector('.mobile-menu-overlay');
    const menuLinks = document.querySelectorAll('.mobile-menu-link');

    if (!menuBtn || !menuOverlay) return;

    const openMenu = () => {
        menuOverlay.classList.remove('pointer-events-none', 'opacity-0');
        menuOverlay.classList.add('opacity-100');
        const menuPanel = menuOverlay.querySelector('.mobile-menu-panel');
        if (menuPanel) {
            menuPanel.classList.remove('translate-y-4', 'scale-95');
            menuPanel.classList.add('translate-y-0', 'scale-100');
        }
        document.body.style.overflow = 'hidden'; // Stop page scrolling under menu
    };

    const closeMenu = () => {
        menuOverlay.classList.remove('opacity-100');
        menuOverlay.classList.add('opacity-0', 'pointer-events-none');
        const menuPanel = menuOverlay.querySelector('.mobile-menu-panel');
        if (menuPanel) {
            menuPanel.classList.remove('translate-y-0', 'scale-100');
            menuPanel.classList.add('translate-y-4', 'scale-95');
        }
        document.body.style.overflow = '';
    };

    menuBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // Close when clicking layout mask
    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) {
            closeMenu();
        }
    });

    // Close when selecting a link
    menuLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });
}

/* ==========================================
   3. Contact Form & Feedback Validation
   ========================================== */
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const messageInput = document.getElementById('message');

        let isValid = true;

        // Reset error stylings
        [nameInput, emailInput, messageInput].forEach(input => {
            if (input) {
                input.classList.remove('border-red-500', 'focus:border-red-500');
                const errLabel = input.parentNode.querySelector('.error-message');
                if (errLabel) errLabel.remove();
            }
        });

        // Simple Validation Checks
        if (nameInput && !nameInput.value.trim()) {
            showInputError(nameInput, 'Name is required');
            isValid = false;
        }

        if (emailInput) {
            const emailVal = emailInput.value.trim();
            if (!emailVal) {
                showInputError(emailInput, 'Email is required');
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                showInputError(emailInput, 'Please enter a valid email address');
                isValid = false;
            }
        }

        if (messageInput && !messageInput.value.trim()) {
            showInputError(messageInput, 'Message cannot be empty');
            isValid = false;
        }

        if (isValid) {
            // Form is successfully filled - trigger simulated visual toast notification
            showToast('Message sent successfully! I will get back to you soon.');
            form.reset();
        }
    });

    function showInputError(input, message) {
        input.classList.add('border-red-500', 'focus:border-red-500');
        const error = document.createElement('span');
        error.className = 'error-message text-red-500 text-xs font-label-sm uppercase tracking-wider block mt-1';
        error.textContent = message;
        input.parentNode.appendChild(error);
        
        // Add listener to clear error on input edit
        input.addEventListener('input', function clearError() {
            input.classList.remove('border-red-500', 'focus:border-red-500');
            error.remove();
            input.removeEventListener('input', clearError);
        });
    }

    // Success Toast System
    function showToast(message) {
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-[calc(100%-40px)]';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = 'glass-panel p-6 rounded-2xl bg-white/70 dark:bg-black/70 border border-white/20 dark:border-white/10 shadow-lg text-on-surface dark:text-inverse-on-surface transform translate-y-4 opacity-0 transition-all duration-500 flex items-start gap-4 pointer-events-auto';
        
        toast.innerHTML = `
            <span class="material-symbols-outlined text-green-500" data-icon="check_circle">check_circle</span>
            <div class="flex-1">
                <h4 class="font-label-sm text-sm uppercase tracking-wider text-green-500 font-semibold mb-1">Success</h4>
                <p class="font-body-md text-sm text-on-surface-variant dark:text-on-surface-variant/80">${message}</p>
            </div>
            <button class="text-on-surface-variant hover:text-on-surface hover:opacity-100 opacity-60 transition-opacity">
                <span class="material-symbols-outlined text-base" data-icon="close">close</span>
            </button>
        `;

        toastContainer.appendChild(toast);

        // Slide/fade in
        setTimeout(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);

        // Close logic on click
        const closeBtn = toast.querySelector('button');
        const dismissToast = () => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        };
        closeBtn.addEventListener('click', dismissToast);

        // Auto dismiss after 5s
        setTimeout(dismissToast, 5000);
    }
}

/* ==========================================
   4. Scroll Reveal IntersectionObserver
   ========================================== */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    // Unobserve once shown
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px' // Trigger slightly before screen entry
        });

        revealElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for older browsers
        revealElements.forEach(el => el.classList.add('active'));
    }
}
/* ==========================================
   6. Image Lazy Loading + Skeleton System
   ========================================== */
function initImages() {
    // Find all images inside .img-wrap containers
    const wraps = document.querySelectorAll('.img-wrap');

    wraps.forEach(wrap => {
        const img = wrap.querySelector('img');
        if (!img) return;

        // Always use lazy loading for non-hero images
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');

        const markLoaded = () => {
            wrap.classList.add('loaded');
            wrap.classList.remove('error');
        };
        const markError = () => {
            wrap.classList.add('error');
            wrap.classList.remove('loaded');
        };

        // If already cached and loaded
        if (img.complete && img.naturalWidth > 0) {
            markLoaded();
        } else if (img.complete && img.naturalWidth === 0) {
            markError();
        } else {
            img.addEventListener('load', markLoaded);
            img.addEventListener('error', markError);
        }
    });

    // Also handle bare images NOT in .img-wrap (hero absolute images)
    // Give them lazy loading attributes for performance
    document.querySelectorAll('img:not(.img-wrap img)').forEach(img => {
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
        }
    });
}

