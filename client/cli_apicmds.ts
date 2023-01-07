import * as commander from "npm:commander";

export const uploadCmd = new commander.Command('upload')
    .description('upload a file');

export const downloadCmd = new commander.Command('download')
    .description('download a file');    

export const infoCmd = new commander.Command('getinfo')
    .description('get info about a file ');    

export const deleteCmd = new commander.Command('delete')
    .description('delete file from server'); 

export const renameCmd = new commander.Command('rename')
    .description('rename file on server'); 