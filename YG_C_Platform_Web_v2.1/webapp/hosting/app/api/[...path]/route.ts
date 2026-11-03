import {env} from "cloudflare:workers";
import {handle} from "../../cloud-api.mjs";
export const dynamic="force-dynamic";
const route=(request:Request)=>handle(request,env);
export {route as GET,route as POST,route as PUT,route as PATCH,route as DELETE};
