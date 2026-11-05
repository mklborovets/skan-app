export type AppScreenName =
  | 'Library'
  | 'CameraScan'
  | 'CropEdit'
  | 'DocumentReview'
  | 'PdfPreview';

export interface NavigationRouteState {
  screen: AppScreenName;
  activePageId?: string;
  activeDocumentId?: string;
}
