<script setup lang="ts">
import { useRouter } from "vue-router";
import { xj, data, status } from "../stores";
import { onMounted, computed, watch } from "vue";
import { theme, NavigationBar, popup, SliderCard, FunctionCard, ModeCard } from 'xjiang-ui';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const router = useRouter();
const navBar = {
  title: "H5 demo",
  right: [{
    key: 'menu',
    badge: true,
    onClick: () => {
      router.push("./setting")
    }
  }]
}
</script>

<template>
  <!-- <NavigationBar 
    :title="navBar.title"
    :right="navBar.right"
  /> -->
  <main class="main">
    <div>
      <FunctionCard text="Ble demo" :showArrow="true" @click="(v) => router.push('./bleHome')" />
      <FunctionCard text="Light demo" :showArrow="true" @click="(v) => router.push('./lightHome')" />
      <FunctionCard text="Bath Heater demo" :showArrow="true" @click="(v) => router.push('./bathHeaterHome')" />
      <FunctionCard text="Heater demo" :showArrow="true" @click="(v) => router.push('./heaterHome')" />
      <FunctionCard text="Towel demo" :showArrow="true" @click="(v) => router.push('./towelHome')" />
      <FunctionCard text="Fan demo" :showArrow="true" @click="(v) => router.push('./fanHome')" />
      <FunctionCard text="Curtain demo" :showArrow="true" @click="(v) => router.push('./curtainHome')" />
      <FunctionCard text="Infrared Air Condition demo" :showArrow="true"
        @click="(v) => router.push('./infraredAirConHome')" />
      <FunctionCard text="MyClocks" :showArrow="true" @click="(v) => router.push('./clocks')" />
      <FunctionCard text="YoYo" :showArrow="true" @click="(v) => router.push('./yoyo')" />
    </div>
  </main>
</template>

<style lang="scss" scoped>
.deviceImg {
  height: 14rem;
  background-color: #ddd;
}

.card {
  border-radius: 10px;
  background-color: #fff;
}

.cardDisabled {
  opacity: .5;
}

.functionCard,
.connectCard {
  padding: .8rem 1.1rem;
  min-height: 5rem;
  margin-top: 1.1rem;
  display: flex;
  align-items: center;

  span {
    margin-left: 10px;
    flex: 1;
    font-size: 1.1rem;
  }
}

.connectCard {
  justify-content: space-between;

  &>div {
    display: flex;
    align-items: center;
  }

  button {
    width: 4rem;
    height: 2rem;
    border-radius: 2rem;
    border: 1px solid rgb(255, 81, 0);
    background-color: rgb(255, 81, 0, .05);
    color: rgb(255, 81, 0);
  }
}
</style>