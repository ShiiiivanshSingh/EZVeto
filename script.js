document.addEventListener('DOMContentLoaded', () => {
    const mapCards = document.querySelectorAll('.map-card');
    const bannedMapsContainers = document.querySelectorAll('.banned-maps');
    let currentTeam = 1;

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            // Get the distance from the top of the page to the target element
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    });

    // Drag and drop functionality
    mapCards.forEach(card => {
        card.addEventListener('dragstart', dragStart);
        card.addEventListener('dragend', dragEnd);
    });

    bannedMapsContainers.forEach(container => {
        container.addEventListener('dragover', dragOver);
        container.addEventListener('drop', drop);
    });

    function dragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.map);
    }

    function dragEnd(e) {
        e.target.classList.remove('dragging');
    }

    function dragOver(e) {
        e.preventDefault();
        e.target.classList.add('drag-over');
    }

    function drop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        const mapName = e.dataTransfer.getData('text/plain');
        const mapCard = document.querySelector(`[data-map="${mapName}"]`);
        
        if (e.target.children.length < 3) { // Limit to 3 bans per team
            const clone = mapCard.cloneNode(true);
            clone.classList.add('banned');
            e.target.appendChild(clone);
            mapCard.style.opacity = '0.5';
            mapCard.setAttribute('draggable', 'false');
            
            currentTeam = currentTeam === 1 ? 2 : 1;
            updateTurnIndicator();
        }
    }
    function updateTurnIndicator() {
        const teams = document.querySelectorAll('.team-container h3');
        teams.forEach((team, index) => {
            team.style.color = index + 1 === currentTeam ? '#00ff88' : '#ffffff';
        });
    }

    // Parallax effect for hero section
    window.addEventListener('scroll', () => {
        const hero = document.querySelector('.hero');
        const scrolled = window.pageYOffset;
        hero.style.backgroundPositionY = scrolled * 0.5 + 'px';
    });

    // Add this at the beginning of your DOMContentLoaded event listener
    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        menu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
            hamburger.classList.remove('active');
            menu.classList.remove('active');
        }
    });

    // Close menu when clicking a link
    document.querySelectorAll('.menu a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            menu.classList.remove('active');
        });
    });
}); 