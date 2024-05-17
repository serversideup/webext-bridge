<template>
    <div class="py-12 max-w-7xl mx-auto flex flex-col">
        <h2 class="text-base font-sans font-medium text-[#94969C] text-center">Supports all major browsers</h2>
        <div class="flex items-center justify-center mt-8 space-x-6">
            <div class="flex items-center">
                <div class="flex items-center justify-center ml-[10px] mr-[4px] w-12 h-12">
                    <Chrome class="w-full"/>
                </div>
                <span class="font-semibold text-3xl text-white">Chrome</span>
            </div>

            <div class="flex items-center">
                <div class="flex items-center justify-center ml-[10px] mr-[4px] w-12 h-12">
                    <Firefox class="w-full"/>
                </div>
                <span class="font-semibold text-3xl text-white">Firefox</span>
            </div>

            <div class="flex items-center">
                <div class="flex items-center justify-center ml-[10px] mr-[4px] w-12 h-12">
                    <Edge class="w-full"/>
                </div>
                <span class="font-semibold text-3xl text-white">Edge</span>
            </div>

            <div class="flex items-center">
                <div class="flex items-center justify-center ml-[10px] mr-[4px] w-12 h-12">
                    <Safari class="w-full"/>
                </div>
                <span class="font-semibold text-3xl text-white">Safari</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import Chrome from '@/components/Icons/Logos/Chrome.vue';
import Firefox from '@/components/Icons/Logos/Firefox.vue';
import Edge from '@/components/Icons/Logos/Edge.vue';
import Safari from '@/components/Icons/Logos/Safari.vue';
</script>