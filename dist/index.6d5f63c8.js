!function(n) {
    function i1() {
        AOS.init({
            duration: 1000,
            easing: "ease-in-out-back",
            once: !0
        });
    }
    if (n(".typed").length) {
        let t = n(".typed").data("typed-items");
        t = t.split(",");
        new Typed(".typed", {
            strings: t,
            loop: !0,
            typeSpeed: 100,
            backSpeed: 50,
            backDelay: 2000
        });
    }
    n(document).on("click", ".nav-menu a, .scrollto", function(t) {
        if (location.pathname.replace(/^\//, "") == this.pathname.replace(/^\//, "") && location.hostname == this.hostname) {
            t.preventDefault();
            const i = n(this.hash);
            if (i.length) {
                const t = i.offset().top;
                return n("html, body").animate({
                    scrollTop: t
                }, 1500, "easeInOutExpo"), n(this).parents(".nav-menu, .mobile-nav").length && (n(".nav-menu .active, .mobile-nav .active").removeClass("active"), n(this).closest("li").addClass("active")), n("body").hasClass("mobile-nav-active") && (n("body").removeClass("mobile-nav-active"), n(".mobile-nav-toggle i").toggleClass("icofont-navigation-menu icofont-close")), !1;
            }
        }
    });
    n(document).ready(function() {
        if (window.location.hash) {
            const t = window.location.hash;
            if (n(t).length) {
                const i = n(t).offset().top;
                n("html, body").animate({
                    scrollTop: i
                }, 1500, "easeInOutExpo");
            }
        }
    });
    n(document).on("click", ".mobile-nav-toggle", function() {
        n("body").toggleClass("mobile-nav-active");
        n(".mobile-nav-toggle i").toggleClass("icofont-navigation-menu icofont-close");
    });
    n(document).click(function(t) {
        const i = n(".mobile-nav-toggle");
        i.is(t.target) || i.has(t.target).length !== 0 || n("body").hasClass("mobile-nav-active") && (n("body").removeClass("mobile-nav-active"), n(".mobile-nav-toggle i").toggleClass("icofont-navigation-menu icofont-close"));
    });
    var r1 = n("section"), t1 = n(".nav-menu, .mobile-nav");
    n(window).on("scroll", function() {
        var i = n(this).scrollTop() + 200;
        r1.each(function() {
            const r = n(this).offset().top, u = r + n(this).outerHeight();
            i >= r && i <= u && (i <= u && t1.find("li").removeClass("active"), t1.find(`a[href="#${n(this).attr("id")}"]`).parent("li").addClass("active"));
            i < 300 && n(".nav-menu ul:first li:first").addClass("active");
        });
    });
    n(window).scroll(function() {
        n(this).scrollTop() > 100 ? n(".back-to-top").fadeIn("slow") : n(".back-to-top").fadeOut("slow");
    });
    n(".back-to-top").click(function() {
        return n("html, body").animate({
            scrollTop: 0
        }, 1500, "easeInOutExpo"), !1;
    });
    n('[data-toggle="counter-up"]').counterUp({
        delay: 10,
        time: 1000
    });
    n(".skills-content").waypoint(function() {
        n(".progress .progress-bar").each(function() {
            n(this).css("width", n(this).attr("aria-valuenow") + "%");
        });
    }, {
        offset: "80%"
    });
    n(window).on("load", function() {
        var t = n(".portfolio-container").isotope({
            itemSelector: ".portfolio-item",
            layoutMode: "fitRows"
        });
        n("#portfolio-flters li").on("click", function() {
            n("#portfolio-flters li").removeClass("filter-active");
            n(this).addClass("filter-active");
            t.isotope({
                filter: n(this).data("filter")
            });
            i1();
        });
        n(document).ready(function() {
            n(".venobox").venobox();
        });
    });
    n(".testimonials-carousel").owlCarousel({
        autoplay: !0,
        dots: !0,
        loop: !0,
        responsive: {
            0: {
                items: 1
            },
            768: {
                items: 2
            },
            900: {
                items: 3
            }
        }
    });
    n(".portfolio-details-carousel").owlCarousel({
        autoplay: !0,
        dots: !0,
        loop: !0,
        items: 1
    });
    n(window).on("load", function() {
        i1();
    });
}(jQuery);

//# sourceMappingURL=index.6d5f63c8.js.map
