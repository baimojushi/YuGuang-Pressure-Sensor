/**
 * 灵机产品物模型标识映射。
 * 从你在平台创建并同步到 XJ_H5 的真实物模型填写下列名称。
 * 禁止使用猜测的 prop.N.N、PID、设备密钥或正式服务端令牌。
 */
export const yuguangFields: Record<'power'|'focus'|'rpm'|'sensorState', string | null> = {
  power: null,       // 允许情感光，bool、可写
  focus: null,       // 深度专注，bool、可写
  rpm: null,         // 设备计算的呼吸频率，number、只读（可选）
  sensorState: null  // 设备采集状态，string、只读（可选）
};
