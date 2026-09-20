<script lang="ts">
import { loadFonts } from './composables/loadFonts'
import { fontStatus } from './composables/useFontStatus'
export default {
  onLaunch() {
    loadFonts().then((result) => {
      fontStatus.value = result
    })
  },
}
</script>
<style lang="scss">
@import './styles/tokens.scss';
@import './styles/fonts.scss';
@import './styles/main.scss';
@import './styles/content.scss';
@import './styles/showcase.scss';
@import './styles/refinements.scss';
</style>
