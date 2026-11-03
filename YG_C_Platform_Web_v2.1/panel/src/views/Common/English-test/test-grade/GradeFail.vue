<script setup lang="ts"></script>

<template>
    <div class="english-test-fail">
        <img class="english-test-fail-img"
            src="https://agent-file-manger.tos-cn-shanghai.volces.com/agent-marchant-test/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_a26ba09c-4685-4d69-84c3-ddd528babee2%403x.png"
            alt="" />
        <p class="english-test-fail-text">
            测评结果报告暂时<span class="english-test-fail-highlight">无法生成</span>，下次记得要测评超过1分钟哦
        </p>
    </div>
</template>

<style lang="scss" scoped>
.english-test-fail {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex: 1;
    padding: 20px;
}

.english-test-fail-img {
    width: 112px;
    height: 112px;
    object-fit: contain;
}

.english-test-fail-text {
    margin: 0;
    padding: 0 20px;
    width: 80%;
    font-size: 14px;
    font-weight: 500;
    line-height: 18px;
    color: #191919;
    text-align: center;
}

.english-test-fail-highlight {
    color: #ff1d18;
}
</style>