<template>
<Transition name="fade">
<!-- Below ItemPickerModal (210) so the sim's weapon/ammo/target pickers stack above -->
<div class="modal-backdrop" v-if="open" @click.self="$emit('close')" style="z-index: 205;">
    <Transition name="modal" appear>
    <div class="modal ballistics-modal" v-if="open">
        <button class="modal-close" @click="$emit('close')">&times;</button>
        <div class="ballistics-modal-body">
            <slot />
        </div>
    </div>
    </Transition>
</div>
</Transition>
</template>

<script>
export default {
    name: 'BallisticsModal',
    props: {
        open: { type: Boolean, default: false },
    },
    emits: ['close'],
    mounted() {
        window.addEventListener('keydown', this.onKeydown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onKeydown);
    },
    methods: {
        onKeydown(e) {
            if (e.key === 'Escape' && this.open) this.$emit('close');
        },
    },
};
</script>

<style scoped>
/* Full-screen with a standard gutter */
.modal-backdrop {
    padding: 1.5rem;
}

.ballistics-modal {
    max-width: none;
    width: 100%;
    height: 100%;
}

.ballistics-modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
}
</style>
