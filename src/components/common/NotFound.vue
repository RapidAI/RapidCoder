<template>
  <a-layout-content class="custom-content">
    <div class="content-wrapper">
      <h1>404 - 页面未找到</h1>
      <p>哎呀！您寻找的页面已经消失或从未存在。</p>
      <div>
        <router-link to="/" class="home-link">返回对话页面</router-link>
      </div>
    </div>
  </a-layout-content>
</template>

<script>
export default {
  name: 'NotFound'
}
</script>

<style scoped>
.content-wrapper {
  text-align: center;
}

h1 {
  font-size: 3em;
  margin-bottom: 20px;
}

p {
  font-size: 1.5em;
  margin-bottom: 30px;
  color: #595959;
}

.home-link {
  display: inline-block;
  padding: 10px 20px;
  background-color: #1890ff;
  color: white;
  border-radius: 5px;
  text-decoration: none;
  transition: background-color 0.3s;
}

.home-link:hover {
  background-color: #1765ad;
}
</style>
