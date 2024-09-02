<template>
  <a-config-provider :theme="theme">
    <Dashboard/>
  </a-config-provider>
</template>

<script>
import Dashboard from "@/components/layout/Dashboard.vue";

export default {
  name: 'App',
  components: { Dashboard },
  data: () => ({
    theme: {
      token: {
        borderRadius: 4,
        controlItemBgActive: "rgb(236,236,236)",
        colorItemTextSelected: "#111",
        wireframe: true
      },
      components: {
        Menu: {
          colorItemTextSelected: "#111"
        }
      }
    }
  })
}
</script>