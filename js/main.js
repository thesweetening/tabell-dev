/**// Grundläggande JavaScript för Tabell.top

 * Main JavaScript för Tabell.topdocument.addEventListener('DOMContentLoaded', function() {

 * Hanterar navigation och grundläggande funktionalitet    console.log('Tabell.top - Webbsida laddad');

 */    

    // Smooth scrolling för interna länkar

document.addEventListener('DOMContentLoaded', function() {    const links = document.querySelectorAll('a[href^="#"]');

    console.log('🏒 Tabell.top laddad!');    links.forEach(link => {

            link.addEventListener('click', function(e) {

    // Setup navigation            e.preventDefault();

    setupNavigation();            

                const targetId = this.getAttribute('href');

    // Setup animations            const targetElement = document.querySelector(targetId);

    setupAnimations();            

});            if (targetElement) {

                targetElement.scrollIntoView({

// Navigation setup                    behavior: 'smooth'

function setupNavigation() {                });

    const navToggle = document.querySelector('.nav-toggle');            }

    const navMenu = document.querySelector('.nav-menu');        });

        });

    if (navToggle && navMenu) {    

        navToggle.addEventListener('click', () => {    // Enkel animering för feature cards

            navMenu.classList.toggle('active');    const observerOptions = {

        });        threshold: 0.1,

                rootMargin: '0px 0px -50px 0px'

        // Close menu when clicking outside    };

        document.addEventListener('click', (e) => {    

            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {    const observer = new IntersectionObserver(function(entries) {

                navMenu.classList.remove('active');        entries.forEach(entry => {

            }            if (entry.isIntersecting) {

        });                entry.target.style.opacity = '1';

    }                entry.target.style.transform = 'translateY(0)';

                }

    // Highlight current page        });

    highlightCurrentPage();    }, observerOptions);

}    

    // Observera feature cards för animering

// Highlight current page in navigation    const featureCards = document.querySelectorAll('.feature-card');

function highlightCurrentPage() {    featureCards.forEach(card => {

    const currentPath = window.location.pathname;        card.style.opacity = '0';

    const navLinks = document.querySelectorAll('.nav-link');        card.style.transform = 'translateY(20px)';

            card.style.transition = 'opacity 0.6s, transform 0.6s';

    navLinks.forEach(link => {        observer.observe(card);

        const href = link.getAttribute('href');    });

            

        // Remove active class first    // Responsiv navigation (för framtida utbyggnad)

        link.classList.remove('active');    const navToggle = document.querySelector('.nav-toggle');

            const navMenu = document.querySelector('.nav-menu');

        // Add active class if matches    

        if ((href === '/' && currentPath === '/') ||     if (navToggle && navMenu) {

            (href !== '/' && currentPath.includes(href))) {        navToggle.addEventListener('click', function() {

            link.classList.add('active');            navMenu.classList.toggle('active');

        }        });

    });    }

}});

// Setup scroll animations
function setupAnimations() {
    // Fade in elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements with animation classes
    document.querySelectorAll('.fade-in, .slide-in').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});