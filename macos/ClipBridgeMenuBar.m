#import <AppKit/AppKit.h>

@interface ClipBridgeApp : NSObject <NSApplicationDelegate>
@property NSStatusItem *statusItem;
@property NSTask *serverProcess;
@property NSTimer *readinessTimer;
@property NSDate *startedAt;
@property NSURL *panelURL;
@property NSURL *deviceURL;
@property NSString *instanceId;
@end

@implementation ClipBridgeApp
- (instancetype)init {
    if ((self = [super init])) {
        _panelURL = [NSURL URLWithString:@"http://127.0.0.1:39393/ui"];
        _instanceId = [[[NSUUID UUID].UUIDString stringByReplacingOccurrencesOfString:@"-" withString:@""] lowercaseString];
    }
    return self;
}

- (NSURL *)projectRoot {
    NSString *override = NSProcessInfo.processInfo.environment[@"CLIPBRIDGE_ROOT"];
    if (override.length) return [NSURL fileURLWithPath:override isDirectory:YES];
    NSURL *url = [NSURL fileURLWithPath:NSProcessInfo.processInfo.arguments[0]].URLByStandardizingPath;
    for (NSInteger i = 0; i < 5; i++) url = url.URLByDeletingLastPathComponent;
    return url;
}

- (void)applicationDidFinishLaunching:(NSNotification *)note {
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    NSString *bundleId = NSBundle.mainBundle.bundleIdentifier ?: @"";
    for (NSRunningApplication *app in [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleId]) {
        if (app.processIdentifier != NSProcessInfo.processInfo.processIdentifier) {
            NSInteger port = [self readPort:[self.projectRoot URLByAppendingPathComponent:@".clipbridge/config.json"]];
            self.panelURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/ui", (long)port]];
            [NSWorkspace.sharedWorkspace openURL:self.panelURL];
            [NSApp terminate:nil];
            return;
        }
    }
    [self configureMenu];
    NSError *error;
    if (![self startRelay:&error]) [self showFailure:error.localizedDescription];
}

- (void)configureMenu {
    self.statusItem = [NSStatusBar.systemStatusBar statusItemWithLength:NSVariableStatusItemLength];
    NSStatusBarButton *button = self.statusItem.button;
    NSURL *iconURL = [NSBundle.mainBundle URLForResource:@"brand-icon-96" withExtension:@"png"];
    NSImage *image = iconURL ? [[NSImage alloc] initWithContentsOfURL:iconURL] : nil;
    if (image) { image.size = NSMakeSize(19, 19); image.template = NO; button.image = image; }
    else button.title = @"🌉";
    button.toolTip = @"ClipBridge · Mac relay node";
    NSMenu *menu = [NSMenu new];
    [menu addItemWithTitle:@"ClipBridge · Mac 中转节点" action:nil keyEquivalent:@""];
    [menu addItem:NSMenuItem.separatorItem];
    NSMenuItem *open = [menu addItemWithTitle:@"打开管理面板" action:@selector(openPanel:) keyEquivalent:@"o"];
    open.target = self;
    NSMenuItem *copy = [menu addItemWithTitle:@"复制设备网址" action:@selector(copyDeviceURL:) keyEquivalent:@"c"];
    copy.target = self;
    [menu addItem:NSMenuItem.separatorItem];
    NSMenuItem *quit = [menu addItemWithTitle:@"退出 ClipBridge" action:@selector(quit:) keyEquivalent:@"q"];
    quit.target = self;
    self.statusItem.menu = menu;
}

- (BOOL)startRelay:(NSError **)error {
    NSURL *root = self.projectRoot;
    NSURL *server = [root URLByAppendingPathComponent:@"src/server.mjs"];
    if (![NSFileManager.defaultManager fileExistsAtPath:server.path]) {
        *error = [NSError errorWithDomain:@"ClipBridge" code:1 userInfo:@{NSLocalizedDescriptionKey:@"找不到 src/server.mjs。请从完整的 ClipBridge 文件夹启动。"}];
        return NO;
    }
    NSURL *state = [root URLByAppendingPathComponent:@".clipbridge" isDirectory:YES];
    if (![NSFileManager.defaultManager createDirectoryAtURL:state withIntermediateDirectories:YES attributes:nil error:error]) return NO;
    NSInteger port = [self readPort:[state URLByAppendingPathComponent:@"config.json"]];
    self.panelURL = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld/ui", (long)port]];
    NSURL *nodeFile = [NSBundle.mainBundle URLForResource:@"node-path" withExtension:nil];
    NSString *node = nodeFile ? [NSString stringWithContentsOfURL:nodeFile encoding:NSUTF8StringEncoding error:nil] : nil;
    node = [node stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (!node.length) {
        *error = [NSError errorWithDomain:@"ClipBridge" code:2 userInfo:@{NSLocalizedDescriptionKey:@"找不到构建时记录的 Node.js 路径。请重新运行 Start-ClipBridge-Mac.command。"}];
        return NO;
    }
    NSURL *outURL = [state URLByAppendingPathComponent:@"server.log"];
    NSURL *errURL = [state URLByAppendingPathComponent:@"server-error.log"];
    [NSFileManager.defaultManager createFileAtPath:outURL.path contents:nil attributes:nil];
    [NSFileManager.defaultManager createFileAtPath:errURL.path contents:nil attributes:nil];
    NSFileHandle *out = [NSFileHandle fileHandleForWritingToURL:outURL error:error];
    NSFileHandle *err = [NSFileHandle fileHandleForWritingToURL:errURL error:error];
    if (!out || !err) return NO;
    NSTask *task = [NSTask new];
    task.executableURL = [NSURL fileURLWithPath:node];
    task.arguments = @[server.path];
    task.currentDirectoryURL = root;
    NSMutableDictionary *env = [NSProcessInfo.processInfo.environment mutableCopy];
    env[@"CLIPBRIDGE_LAUNCH_MODE"] = @"menubar";
    env[@"CLIPBRIDGE_INSTANCE_ID"] = self.instanceId;
    task.environment = env; task.standardOutput = out; task.standardError = err;
    __weak typeof(self) weakSelf = self;
    task.terminationHandler = ^(NSTask *ended) { dispatch_async(dispatch_get_main_queue(), ^{
        typeof(self) self = weakSelf;
        if (self.readinessTimer) [self showFailure:[NSString stringWithFormat:@"中转服务意外退出（状态码 %d）。请查看 .clipbridge/server-error.log。", ended.terminationStatus]];
    }); };
    if (![task launchAndReturnError:error]) return NO;
    self.serverProcess = task; self.startedAt = [NSDate date];
    self.readinessTimer = [NSTimer scheduledTimerWithTimeInterval:.25 target:self selector:@selector(checkReadiness:) userInfo:nil repeats:YES];
    return YES;
}

- (NSInteger)readPort:(NSURL *)url {
    NSData *data = [NSData dataWithContentsOfURL:url];
    NSDictionary *json = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    NSNumber *port = [json isKindOfClass:NSDictionary.class] ? json[@"port"] : nil;
    return [port isKindOfClass:NSNumber.class] ? port.integerValue : 39393;
}

- (void)checkReadiness:(NSTimer *)timer {
    if (-self.startedAt.timeIntervalSinceNow > 15) {
        [self.readinessTimer invalidate]; self.readinessTimer = nil;
        [self showFailure:@"中转服务未能在 15 秒内启动。请查看 .clipbridge/server-error.log。"]; return;
    }
    NSURL *url = [[self.panelURL URLByDeletingLastPathComponent] URLByAppendingPathComponent:@"health"];
    __weak typeof(self) weakSelf = self;
    [[NSURLSession.sharedSession dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSDictionary *health = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        typeof(self) self = weakSelf;
        if (!self || ![health[@"ok"] boolValue] || ![health[@"instanceId"] isEqual:self.instanceId]) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            [self.readinessTimer invalidate]; self.readinessTimer = nil;
            NSArray *urls = health[@"urls"];
            if ([urls isKindOfClass:NSArray.class] && urls.count) self.deviceURL = [NSURL URLWithString:urls.firstObject];
            self.statusItem.button.toolTip = @"ClipBridge · Mac 中转节点已就绪";
            [self openPanel:nil];
        });
    }] resume];
}

- (void)openPanel:(id)sender { [NSWorkspace.sharedWorkspace openURL:self.panelURL]; }
- (void)copyDeviceURL:(id)sender {
    [NSPasteboard.generalPasteboard clearContents];
    [NSPasteboard.generalPasteboard setString:(self.deviceURL ?: self.panelURL).absoluteString forType:NSPasteboardTypeString];
}
- (void)showFailure:(NSString *)message {
    [self.readinessTimer invalidate]; self.readinessTimer = nil;
    NSLog(@"ClipBridge launch failed: %@", message ?: @"unknown error");
    NSAlert *alert = [NSAlert new]; alert.messageText = @"ClipBridge 无法启动";
    alert.informativeText = message ?: @"未知错误"; alert.alertStyle = NSAlertStyleCritical;
    [alert runModal]; [self quit:nil];
}
- (void)quit:(id)sender {
    [self.readinessTimer invalidate];
    if (self.serverProcess.running) { [self.serverProcess terminate]; [self.serverProcess waitUntilExit]; }
    [NSApp terminate:nil];
}
- (void)applicationWillTerminate:(NSNotification *)note { if (self.serverProcess.running) [self.serverProcess terminate]; }
@end

static ClipBridgeApp *appDelegate;

int main(void) {
    @autoreleasepool {
        NSApplication *app = NSApplication.sharedApplication;
        appDelegate = [ClipBridgeApp new];
        app.delegate = appDelegate;
        [app run];
    }
    return 0;
}
