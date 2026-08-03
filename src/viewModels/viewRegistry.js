import {auth_loginVM} from "./auth_login.js";
import {settings_indexVM} from "./settings_index.js";
import {quickview_indexVM} from "./quickview_index.js";
import {seu_dashboardVM} from "./seu_dashboard.js";
import {seu_seus_indexVM} from "./seu_seus_index.js";
import {seu_seus_newVM} from "./seu_seus_new.js";
import {seu_seus_detailVM} from "./seu_seus_detail.js";
import {seu_packs_indexVM} from "./seu_packs_index.js";
import {seu_objectives_indexVM} from "./seu_objectives_index.js";
import {seu_objectives_detailVM} from "./seu_objectives_detail.js";
import {seu_objectives_newVM} from "./seu_objectives_new.js";

// export const viewModels = {
//   "auth/login": auth_loginVM,
//   home: homeVM,
//   "settings/index": settings_indexVM
// };
export const viewModels = {
  "auth/login": auth_loginVM,
  "settings/index": settings_indexVM,
  "quickview/index": quickview_indexVM,
  "seu/dashboard": seu_dashboardVM,
  "seu/seus/index": seu_seus_indexVM,
  "seu/seus/new": seu_seus_newVM,
  "seu/seus/detail": seu_seus_detailVM,
  "seu/packs/index": seu_packs_indexVM,
  "seu/objectives/index": seu_objectives_indexVM,
  "seu/objectives/detail": seu_objectives_detailVM,
  "seu/objectives/new": seu_objectives_newVM
};
