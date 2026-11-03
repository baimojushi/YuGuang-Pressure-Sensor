import {contract} from './contract.mjs';
import {handle} from '../shared/service.mjs';
contract(handle,false,'正式与展示共用逻辑：独立密码账号');
contract(handle,true,'正式与展示共用逻辑：独立平台身份');
