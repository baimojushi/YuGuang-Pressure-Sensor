<script setup lang="ts"></script>

<template>
    <div class="english-test-empty">
        <img class="english-test-empty-img"
            src="https://agent-file-manger.tos-cn-shanghai.volces.com/agent-marchant-test/image%403x.png" alt="" />
        <p class="english-test-empty-title">恭喜你完成了本次英语测评，真的很棒哦～</p>
        <p class="english-test-empty-subtitle">耐心等待，测评结果马上生成</p>
    </div>
</template>

<style lang="scss" scoped>
.english-test-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex: 1;
    padding: 20px;
}

.english-test-empty-img {
    width: 112px;
    height: 112px;
    object-fit: contain;
}

.english-test-empty-title {
    margin: 0;
    padding: 0 20px;
    font-size: 16px;
    font-weight: 500;
    line-height: 18px;
    color: #191919;
    text-align: center;
}

.english-test-empty-subtitle {
    margin: 0;
    padding: 0 20px;
    font-size: 13px;
    line-height: 18px;
    color: #1a2029;
    opacity: 0.6;
    text-align: center;
}
</style>