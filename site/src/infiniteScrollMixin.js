// Render fewer cards per batch on narrow (mobile) viewports: a long
// single-column DOM is what makes scrolling janky on weaker GPUs, so we keep
// the live node count lower and let infinite scroll top it up.
const MOBILE_BREAKPOINT = 768;
function batchSize() {
    return (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT) ? 25 : 50;
}

export const infiniteScrollMixin = {
    data() {
        return { infiniteScrollLimit: batchSize() };
    },
    computed: {
        visibleItems() {
            return this.items.slice(0, this.infiniteScrollLimit);
        },
        hasMore() {
            return this.infiniteScrollLimit < this.items.length;
        },
    },
    watch: {
        items() {
            this.infiniteScrollLimit = batchSize();
        },
    },
    mounted() {
        this._infiniteObserver = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && this.hasMore) {
                    this.infiniteScrollLimit += batchSize();
                }
            },
            { root: this.$el, rootMargin: '0px 0px 300px 0px' }
        );
        this.$nextTick(() => {
            const sentinel = this.$refs.infiniteScrollSentinel;
            if (sentinel) this._infiniteObserver.observe(sentinel);
        });
    },
    beforeUnmount() {
        this._infiniteObserver?.disconnect();
    },
};

