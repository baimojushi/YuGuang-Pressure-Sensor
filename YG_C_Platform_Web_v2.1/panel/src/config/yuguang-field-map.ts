/**
 * 灵机产品物模型标识映射。
 * 以下为物模型 v2（productKey 11879「余光」）里真实存在的属性名，不是猜测值。
 * 该模型存在重复定义：情感光 prop.9.1 与 prop.10.1、呼吸 prop.10.3 与 prop.11.3、
 * 采集状态 prop.10.4 与 prop.12.4。此处绑定 9.1 / 10.2 / 10.3 / 10.4（10.3 为只读），
 * 固件须按这套标识实现；prop.10.1、11.3、12.4 为重复定义，不使用。
 */
/** 仅在灵机云后台已录入 siid 19 并确认六键生成后才能启用写入。 */
export type SuixiField = 'companionEnabled' | 'guideState' | 'guidePeriod' | 'demoCloudDesired' | 'sensorLink' | 'relaxRequest';
export const YG_INTERFACE_VERSION = 'YG-IFACE-2.1.0';
export const siid19Registered = import.meta.env.VITE_YG_ENABLE_SIID19 === 'true';
/* 19.7 是待云端单独注册的扩展属性；与已注册的 19.1–19.6 门禁分离。 */
export const lightPreviewRegistered = siid19Registered &&
  import.meta.env.VITE_YG_ENABLE_SIID19_LIGHT_PREVIEW === 'true';
export const lightPreviewField = lightPreviewRegistered ? 'suixi_LightPreviewCommand' : null;
export const yuguangFields: Record<'power'|'focus'|'rpm'|'sensorState'|SuixiField, string | null> = {
  power: 'power_Prop_9_1',       // 情感光开关，bool、可写（siid 9）
  focus: 'focus_Prop_9_2',       // 深度专注，bool、可写（siid 10）
  rpm: 'focus_Prop_9_3',         // 呼吸频率，number、只读 0–120（siid 10）
  sensorState: 'focus_Prop_9_4', // 采集状态，string、只读（siid 10；约定 ok / no_signal）
  // 下列字段是生成规则已确定的提案名。默认锁定，避免在云平台录入前悬空写入。
  companionEnabled: 'suixi_SuixiSwitch', // 19.1 bool rw
  guideState: 'suixi_GuideState',       // 19.2 string ro
  guidePeriod: 'suixi_GuidePeriod',     // 19.3 uint16 ro，100ms
  demoCloudDesired: 'suixi_CloudPoseOptIn', // 19.4 bool rw，启用意向
  sensorLink: 'suixi_SensorLink',       // 19.5 string ro
  relaxRequest: 'suixi_RelaxRequest'    // 19.6 bool rw，自清
};

export const enabledSuixiField = (field: SuixiField): string | null =>
  siid19Registered ? yuguangFields[field] : null;
