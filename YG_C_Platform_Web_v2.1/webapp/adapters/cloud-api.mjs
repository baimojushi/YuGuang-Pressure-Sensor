// Both hosted and local releases use the same business logic.
import {handle as sharedHandle} from '../shared/backend.mjs';
export const handle=(request,env)=>sharedHandle(request,{...env,AUTH_PROVIDER:'platform',STORAGE_LABEL:'Cloudflare D1 + R2'});
