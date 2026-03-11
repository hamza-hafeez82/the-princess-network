document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.nav-dot');
    const indicator = document.querySelector('.nav-indicator');
    const nav = document.querySelector('.slider-nav');
    let currentSlide = 0;
    let slideInterval;

    function updateIndicator(index) {
        if (!indicator || !dots[index]) return;
        const dot = dots[index];
        const navRect = nav.getBoundingClientRect();
        const dotRect = dot.getBoundingClientRect();

        // Calculate the left position relative to the container
        const leftPos = dotRect.left - navRect.left + (dotRect.width / 2);
        nav.style.setProperty('--indicator-left', `${leftPos}px`);
    }

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        slides[index].classList.add('active');
        dots[index].classList.add('active');
        currentSlide = index;

        updateIndicator(index);
    }

    function nextSlide() {
        let next = (currentSlide + 1) % slides.length;
        showSlide(next);
    }

    function startSlider() {
        stopSlider();
        slideInterval = setInterval(nextSlide, 3000); // 3 seconds per slide
    }

    function stopSlider() {
        clearInterval(slideInterval);
    }

    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showSlide(index);
            startSlider(); // Reset timer on manual click
        });
    });

    // Pause on hover
    const sliderContainer = document.querySelector('.hero-slider');
    if (sliderContainer) {
        sliderContainer.addEventListener('mouseenter', stopSlider);
        sliderContainer.addEventListener('mouseleave', startSlider);
    }

    // Initial position for indicator
    window.addEventListener('resize', () => updateIndicator(currentSlide));

    // Initialize
    showSlide(0);
    startSlider();
});
