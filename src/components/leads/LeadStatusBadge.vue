<script setup>import AppBadge from '../common/AppBadge.vue';defineProps({status:String})</script><template><AppBadge :tone="status">{{status}}</AppBadge></template>
