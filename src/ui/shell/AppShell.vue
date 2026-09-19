<script setup lang="ts">
import NavSideBar from './NavSideBar.vue'
import NavTopBar from './NavTopBar.vue'

// AppShell 是三态布局的唯一决策点：
//   < 768px  手机：顶部玻璃导航（标题行 + 横向导航行），**没有底部标签栏**
//   768–1099 平板：左侧图标窄栏
//   >= 1100  Mac：左侧带文字的侧栏 + 更宽的内容区
// features 里的视图一律不写媒体查询。
</script>

<template>
  <div class="shell">
    <NavSideBar class="shell__side" />
    <NavTopBar class="shell__top" />

    <main class="shell__main">
      <div class="shell__content">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  /* 浮动 chrome 的可用上边界：features 里的 sticky 元素用它定位，
     于是「导航栏下面从哪开始」的断点判断仍然只留在 AppShell 里。 */
  --chrome-top: calc(var(--safe-t) + var(--topbar-h) + var(--navrow-h));
}

.shell__side {
  display: none;
}

.shell__main {
  padding: 16px 16px calc(var(--safe-b) + 40px);
}

.shell__content {
  max-width: 720px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .shell {
    /* 窄栏模式下没有顶部导航，浮动 chrome 可以贴到顶 */
    --chrome-top: 0px;
  }

  .shell__side {
    display: flex;
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--rail-w);
  }

  .shell__top {
    display: none;
  }

  .shell__main {
    margin-left: var(--rail-w);
    padding: 32px 28px 64px;
  }

  .shell__content {
    max-width: 760px;
  }

  /* 窄栏模式下只显示图标 */
  .shell__side :deep(.nav__label) {
    display: none;
  }
}

@media (min-width: 1100px) {
  .shell__side {
    width: var(--side-w);
  }

  .shell__main {
    margin-left: var(--side-w);
    padding: 44px 40px 80px;
  }

  .shell__content {
    max-width: 900px;
  }

  .shell__side :deep(.nav__label) {
    display: inline;
  }
}
</style>
