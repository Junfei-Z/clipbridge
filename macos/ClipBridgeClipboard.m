#import <AppKit/AppKit.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 2) return 64;
        NSPasteboard *pasteboard = NSPasteboard.generalPasteboard;
        NSString *mode = [NSString stringWithUTF8String:argv[1]];
        if ([mode isEqualToString:@"read"]) {
            NSString *value = [pasteboard stringForType:NSPasteboardTypeString] ?: @"";
            NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
            [NSFileHandle.fileHandleWithStandardOutput writeData:data];
            return 0;
        }
        if ([mode isEqualToString:@"write"]) {
            NSData *data = [NSFileHandle.fileHandleWithStandardInput readDataToEndOfFile];
            NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
            if (!value) return 65;
            [pasteboard clearContents];
            return [pasteboard setString:value forType:NSPasteboardTypeString] ? 0 : 1;
        }
        return 64;
    }
}
