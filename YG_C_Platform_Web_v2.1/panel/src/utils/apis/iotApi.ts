import request from "@/utils/request";
import { resolveIotUrl } from "@/utils/resolveIotUrl";
import type { ApiRequestResponse } from "./authApi";

/** 家庭信息 */
export interface FamilyInfo {
  id: number;
  familyName?: string;
  name?: string;
  [key: string]: unknown;
}

/** 房间信息 */
export interface RoomInfo {
  id: number;
  familyId?: number;
  roomName?: string;
  name?: string;
  [key: string]: unknown;
}

/** 用户设备 */
export interface UserDevice {
  bindGatewayDid: number;
  bindTime: string;
  createTime: string;
  deviceName: string;
  deviceType: number;
  did: number;
  h5Url: string;
  gatewayType: number;
  id: number;
  isShare: number;
  mac: string | null;
  mcuVersion: number | null;
  moduleVersion: number | null;
  netSet: number;
  netType: number;
  pid: number;
  productIcon: string;
  productName: string;
  sn: string;
  status: number;
}

/** 家庭列表（家庭下含其房间） */
export interface FamilyListResult {
  list: {
    room: RoomInfo[];
    family: FamilyInfo;
    device: number;
  }[];
}

/** 房间列表（房间下含其设备） */
export interface RoomListResult {
  list: {
    room: RoomInfo;
    device: UserDevice[];
  }[];
}

/** 获取家庭列表 */
export async function getFamilyList() {
  return (await request.get(
    resolveIotUrl("/iotservice/api/iot/family")
  )) as ApiRequestResponse<FamilyListResult>;
}

/** 按家庭 id 获取房间及房间下的设备列表 */
export async function getRoomList(params: { id: number }) {
  return (await request.get(
    import.meta.env.VITE_APP_IOT_API + "/iotservice/api/iot/room",
    {
      params
    }
  )) as ApiRequestResponse<RoomListResult>;
}
