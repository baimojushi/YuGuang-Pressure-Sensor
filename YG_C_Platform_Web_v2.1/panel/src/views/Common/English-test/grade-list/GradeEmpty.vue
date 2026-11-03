<script setup lang="ts">
import { useI18n } from "vue-i18n";
import emptyImg from "@/assets/images/english/english-empty.png";

const { t } = useI18n();
</script>

<template>
    <div class="english-grade-empty">
        <img class="english-grade-empty-img" :src="emptyImg" alt="" />
        <p class="english-grade-empty-text">{{ t("grade_list_empty") }}</p>
    </div>
</template>

<style lang="scss" scoped>
.english-grade-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex: 1;
}

.english-grade-empty-img {
    width: 80px;
    height: 80px;
    object-fit: contain;
}

.english-grade-empty-text {
    margin: 0;
    padding: 0 20px;
    font-size: 13px;
    line-height: 18px;
    color: #1a2029;
    opacity: 0.6;
    text-align: center;
}
</style>