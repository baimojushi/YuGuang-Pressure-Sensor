import requestAgent from "@/utils/requestAgent";

export interface HistoryListData {
  result?: {
    content?: {
      weeklyReports: weeklyReports[];
      monthlyReports: weeklyReports[];
    };
  };
  ok?: boolean;
  msg: "";
  status?: number;
}
export interface DeleteHistoryData {
  result?: {};
  ok?: boolean;
  msg: "";
  status?: number;
}
export interface weeklyReports {
  reportType: string;
  reportDate: string;
  id: number;
  periodStart: string;
  periodEnd: string;
}

export interface historyListQueryParams {
  deviceId: string;
  type?: "week" | "month";
  page?: number;
  size?: number;
}

export interface deleteHistoryReportParams {
  period_type: string;
  date: string;
}

export async function getHistoryList(params: historyListQueryParams) {
  return (await requestAgent.get(`/app/api/olap/device-usage/reports/history`, {
    params
  })) as HistoryListData;
}
export async function deleteHistoryReport(params: deleteHistoryReportParams) {
  return (await requestAgent.delete(`/app/api/olap/growth/reports`, {
    params
  })) as DeleteHistoryData;
}
export async function deleteDeviceUsageReport(params: {
  reportId: number;
  period_type: string;
}) {
  return (await requestAgent.delete(
    `/app/api/olap/device-usage/reports/${params.reportId}`,
    {
      params
    }
  )) as DeleteHistoryData;
}
