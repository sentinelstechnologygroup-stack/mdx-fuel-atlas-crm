import { atlas } from './atlasClient';




export const Core = atlas.integrations.Core;

export const InvokeLLM = atlas.integrations.Core.InvokeLLM;

export const SendEmail = atlas.integrations.Core.SendEmail;

export const SendSMS = atlas.integrations.Core.SendSMS;

export { uploadFileToFirebase as UploadFile } from '@/firebase/storageService';

export const GenerateImage = atlas.integrations.Core.GenerateImage;

export const ExtractDataFromUploadedFile = atlas.integrations.Core.ExtractDataFromUploadedFile;







