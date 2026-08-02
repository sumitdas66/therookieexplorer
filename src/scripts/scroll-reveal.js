const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('is-visible'));
}
