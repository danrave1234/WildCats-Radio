::: header
# Shoutcast DNAS Server Changelog {#shoutcast-dnas-server-changelog align="center"}

(Last Updated 30 Oct 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [2.6.0 Build 747](#747)                                             |
| - [2.5.5 Build 733](#733)                                             |
| - [2.5.1 Build 724](#724)                                             |
| - [2.4.8 Build 700](#700)                                             |
| - [2.4.7 Build 256](#256)                                             |
| - [2.4.2 Build 167 / 168](#167)                                       |
| - [2.4.1 Build 164 / 165](#165)                                       |
| - [2.4.0 Build 147](#147)                                             |
| - [2.2.2 Build 123](#123)                                             |
| - [2.2.1 Build 109](#109)                                             |
| - [2.2.0 Build 107](#107)                                             |
| - [2.0.0 Build 29](#29)                                               |
| - [2.0.0 Build 28 (RC 2)](#28)                                        |
| - [2.0.0 Build 27 (RC 1)](#27)                                        |
| - [2.0.0 Build 19 (Beta)](#19)                                        |
| - [2.0.0 Build 18 (Beta)](#18)                                        |
| - [2.0.0 Build 17 (Beta)](#17)                                        |
| - [2.0.0 Build 14 (Beta)](#14)                                        |
| - [2.0.0 Build 13 (Beta)](#13)                                        |
| - [2.0.0 Build 10 (Beta)](#10)                                        |
| - [2.0.0 Build 7 (Beta)](#7)                                          |
+-----------------------------------------------------------------------+

[]{#747}

### 2.6.0 Build 747

------------------------------------------------------------------------

- Premium 2.6 features:
- Native SSL stream support (https)
- Personal & Customisable SSL Certificate
- Improved backup stream url support
- New authhash system for 2.6 and higher only
- Premium radiomanager control panel support
- Improved monetization features and trigger methods
- General bug fixes (free and premium versions)

[]{#733}

### 2.5.5 Build 733

------------------------------------------------------------------------

- Improved codec handling
- Allow for per-SID logging (eg streamlogfile_2=\...)
- Improved rate limiting for SC2 clients
- Allow better scaling with multiple SC2 streams
- Improved header parsing in a few odd cases
- Log message cleanups
- Fixed wrongly reported \"vbr\" stream
- Fixed hang on intro/backup files
- Fixed relay getting stuck as inactive
- Fixed pre-roll content via auth for SC2 clients
- Fixed various rare crash cases
- Updated internal libraries to more recent releases:
- Updated: libcurl 7.53.1
- Updated: OpenSSL 1.1.0e
- Updated: zlib 1.2.11
- Updated: expat 2.2.0

[]{#724}

### 2.5.1 Build 724

------------------------------------------------------------------------

- Fix libcurl i686 32bit lib build (ssl was broken)
- Avoid forced icy metadata for Roku and WMP
- Purge adverts not used in some time, frees up memory for re-use
- Adjust automatic cpu scaler
- Drop to HTTP/1.0 in most responses
- Use correct IP for stats engine, xml stats were wrong for XFF
- Improve buffer handling
- Dropping pragma/expires header

### 2.5.1 Build 723

------------------------------------------------------------------------

- Added FLV containerisation support for MP3 and AAC streams (add
  ?type=.flv to compatible stream urls to use)
- Added support for sending title updates to Tunein for DNAS+ streams
- Added \'minbitrate\' and \'streamminbitrate\' options to complement
  the \'maxbitrate\' and \'streammaxbitrate\' options
- Added \'streambitrate\' alias for setting both \'streammaxbitrate\'
  and \'streamminbitrate\' to enforce a single allowed bitrate
- Added the HTML5 player to /index.html?sid=0 page for all compatible
  streams (currently only MP3 streams)
- Added \'type=x\' parameter to force specific connection handling (e.g.
  type=http or type=.flv or type=sc1 or type=sc2 or type=html)
  irrespective of what the connection may indicate from header and
  user-agent values)
- Added unlimited listener support when setting \'maxuser=0\' to allow
  any listener connection (the server will still need to be able to
  support the number of requests when this is enabled to avoid streaming
  issues)
- Added frame syncing support on all source inputs (direct and relay) to
  filter out bad stream data
- Added \'dns\' mappings of the \'ip\' config options (e.g. publicdns
  -\> publicip)
- Added modes to enable / disable only the source and only the listener
  debugging options via mode=debug?option=source and
  mode=debug?option=listener respectively
- Added StreamNext=\'xxx\' to the Shoutcast 1.x-style in-stream title
  updates (will need listener software updates to be able to make use of
  this)
- Added samplerate reporting on the appropriate stream pages and log
  output
- Added rate limiting on all listener handlers to help reduce listeners
  getting too far ahead or adverts being resumed from at the in-correct
  position (or playing the filler as well as the adverts)
- Added \'ratelimit\' to enable control of the frame rate limiting
  feature (set ratelimit=0 to disable if it causes issues)
- Added \'adtestfile\', \'adtestfileloop\', \'streamadtestfile\',
  \'streamadtestfileloop\', and related handling to aid in testing
  advert triggers will work (see documentation for details)
- Added \'adminfile\' support which allows for restricting unwanted
  access to admin.cgi to only valid IP / hostnames added intto the
  \'sc_serv.admin\' file (see documentation for details)
- Added \'forceshortsends\' support which allows for mimicking
  restricted network output which can occassionally be helpful for
  debugging
- Added \'adminnowrap\' support to allow for disabling some of the
  mobile friendly CSS / HTML changes for the stream admin page and its
  display of the listener list
- Added a sanitised configuration settings view mode for the server
  administrator to aid in checking that the DNAS is using the settings
  it is meant to be using
- Added /currentmetadata?sid=# which is a more accessible version of the
  admin.cgi mode=viewxml or mode=viewjson and page=5 requests for
  getting the extended stream metadata
- Added support to make better use of the X-Forwarded-For HTTP header
  (use usexff=0 to disable this change) which is helpful if all
  listeners appear to be connected from the local machine due to
  front-facing services
- Added proper handling of HTTP HEAD requests to resolve a number of
  issues with unexpected listener connections and failed source
  connections
- Added a \'kick duplicates\' option to the stream administrator page to
  make it easier to kick duplicate connections from the same user agent
  and address (see documentation for how to use this in a script)
- Added support for direct HTTP sources (e.g. Icecast based sources) to
  be accepted when providing MP3 and AAC based stream content)
- Added support for Shoutcast 1.x sources to be accepted on \'portbase\'
  and not \'portbase+1\' as per the Shoutcast 1.x protocol specification
  which makes it possible for all sources (1.x and 2.x) to be accepted
  on a single port instead of needing two ports (see documentation for
  details and limitations of this mode)\
  \
- Changed authhash management to improve integration with the Radionomy
  platform and services now being offered for Shoutcast broadcasters
- Changed the default CSS / HTML output to adjustements to work better
  on mobile devices / small screens including consolidating and removing
  some of the information on the summary pages
- Changed the YP update to be able to do a full re-add of the stream on
  update incase of YP-side issues on add
- Changed the YP update handling to be more dynamic to aid with remote
  clustering fixes
- Changed to use a new scheduler which allows the server to be more
  flexible and allows the rate limiting support to work correctly
- Changed to require a key press if running normally (non-daemon and
  non-service modes) when a major issue occurs of the server cannot be
  run
- Changed 1.x source handling to check the password earlier in the
  connection steps which allows for quicker checking and setup of the
  source or rejection as applicable
- Changed the the existing playing and admin metadata responses to
  include extended metadata (if available)
- Changed the tailing mode to match the 1.x DNAS so it will now only
  show the log output from when opening the tailing view
- Changed title update to clarify why certain title updates are being
  rejected
- Changed the way that advert triggers are detected and processed to
  increase the reliability of advert triggers being actioned
- Changed some of the page icons to appear more visible on dark
  backgrounds
- Changed log output to only show \'Terminating listeners\...\' if there
  are listeners
- Changed some more internal data sctructures to provide additional
  memory reductions on per-listener basis
- Changed applicable timeout handling to go through a common handler
  which now ensures that per-stream overrides on the timeouts are
  correctly applied
- Changed to indicate CDN mode on backup relay connections
- Changed the internal handling of the config items to better handle
  large stream ids so as to save memory if not using sequential
  streamids (which speeds up config handling as well as potentially
  saving a lot of memory)
- Changed to check and abort starting the DNAS if no source passwords
  are specified
- Changed some of the log start-up wording messages
- Changed the Flash Policy Server to generate the response immediately
  to reduce time to provide a response
- Changed to not check for \<policy-file-request/\> if the Flash Policy
  Server is not enabled on the port
- Changed the HTTP handler to reduce the time to process requests when
  first processing the request
- Changed to show the bitrate of the skipped files to help with
  diagnosing why a file was skipped
- Changed handling of relay and direct 1.x sources to improve
  consistency between them and reduce the time to start a relay
  connection
- Changed the 2.x relay handling to reduce time to setup the relay
  connection as well as reducing memory for the connection setup
- Changed file / advert checking to also check the samplerate to improve
  reliabity of file / advert inserts
- Changed the stream login / logout options to have \'Stream\' in front
  of them to make it clearer vs the main Server actions
- Changed to look for SSLv2 / SSLv3 / TLSv1.x connections and abort them
  as we do not support HTTPS connections and this was causing false
  source connection attempts
- Changed debugging output to make it easier to see the full filepath of
  the control files being used
- Changed when the YP \'add\' is issued to prevent it spamming the
  metrics system if the connnection quickly fails (e.g. when running a
  relay that cannot connect to the source)
- Changed Shoutcast 1.x and HTTP listener connection handling to be done
  separately which allows us to provide an optimised HTTP experience
  than the prior shared handling
- Changed the debugging options admin page to make it easier to enable
  groups of options and find other related usage changes
- Changed the help / documentation links to use a more complete page
  which better details information
- Changed the Windows version to make use of a modified pthread-win32 to
  make internal handling more consistent between OS platforms
- Changed the \'kick all\' button to span across all of \'kick\' actions
  and to respond to clicks anywhere in the element
- Changed the advert status to now be in it\'s own column instead of
  being in the \'connected duration\' column
- Changed the \'sources\' page to show the direct stream urls of the
  configured streams
- Changed error message output to be more consistent between the
  platform versions
- Changed Windows Vista+ usage to better scale for larger listener
  numbers compared to using the Windows XP and prior mode
- Changed the listener duration output to be a more condensed version
  (more like the 1.x DNAS which is better for mobile)
- Changed the ultravox creation to reduce the processing overhead when
  creating such data
- Changed admin.cgi?mode=history to provide XML and JSON responses like
  the /played(.html) method can provide
- Changed to ignore empty icy-icq, icy-irc and icy-aim headers which
  some older sources send and which could cause the source to be
  incorrectly rejected
- Changed to allow empty icy-url headers to improve legacy source
  connection support
- Changed the stream admin page to load the current listener list
  asynchronously instead of waiting for all of the details to load at
  once
- Changed the HTML5 player on the DNAS pages to force http mode
- Changed the HTML5 player on the DNAS pages to be hidden if the browser
  being used does not support such playback of the stream(s)
- Changed to use HTTPS for all communication the DNAS needs to make
- Changed to show the user agent in the banned connection log messages
- Changed to not save \'streamid\' when re-writing or editing the config
  file as the DNAS is able to work this out without needing the option
  to be present (unlike with older 2.x releases)
- Changed to about direct source connections earlier on if the source
  password is incorrect than was previously being done\
  \
- Fixed handling of XML title updates with escaped characters leading to
  unexpected title update failures
- Fixed issues with excessive CPU usage due to connections to the DNAS
  not having enough data ready to be provided or received
- Fixed unexpected CPU usage when under low or no listener load (most
  noticeable on resource limited setups)
- Fixed all reproducible memory and object leaks (mainly against the
  advert implementation)
- Fixed the wrong streampath being used if the streampath config option
  is set but is left empty
- Fixed streampath generation for the HTML5 player on the DNAS pages and
  for any listener / playlist requests (to improve listener / player
  compatibility)
- Fixed Roku playback issues (affects 2.4.x)
- Fixed Winamp 5.6+ playback issues (affects 2.4.7)
- Fixed peaklisteners not being shown when there are no active listeners
  on the server admin page
- Fixed metrics handling issues which were causing corrupted reponses to
  be sent (breaking account statistics)
- Fixed advert updates being re-tried too often and not following the
  server side update interval
- Fixed advert update pulls failing randomly after the first pull
  attempt
- Fixed advert group not being updated in all cases for the existing
  listeners
- Fixed advert groups not being displayed on the admin page in all
  situations
- Fixed no message being shown on the advert groups if there are no
  known advert groups (affects 2.4.7)
- Fixed adverts for Shoutcast 1.x listeners not always firing if no data
  could be sent
- Fixed lock-up for Shoutcast 1.x listener when providing adverts and a
  title update needs to be sent
- Fixed invalid HTTP requests attempting to be handled as a source
  connection
- Fixed advert groups not being updated on the admin page unless some
  internal checks had been made
- Fixed issue with the updater repeatedly re-downloading the update
  (2.4.3 / 2.4.7 beta issue)
- Fixed /admin.cgi?mode=viewxml and /admin.cgi?mode=viewjson requests
  without a page parameter not being allowed for requests using the
  stream source password (resolves a 1.x DNAS compatibility issue)
- Fixed configuration file writing not saving correctly with
  non-sequential stream configurations
- Fixed default \'pidfile\' generation not creating the file in the
  correct directory when run as a daemon (affects 2.4.x)
- Fixed some debug messages from showing when they should not appear in
  non-debug mode
- Fixed passwords containing the \# character being incorrectly rejected
  due to the multi-1.x source support (affects 2.4.7)
- Fixed the edit config handler not being able to create the backup
  config file on Windows (affects 2.4.x)
- Fixed the receive and send buffers not being correctly limited in all
  cases to help prevent overflow issues
- Fixed some of the supporting resource methods not providing compressed
  version of the resource as needed
- Fixed ID3v1.x tags not being correctly stripped from intro / backup /
  adtest files
- Fixed streampath allowing /listen to be used which would cause failed
  stream playback as a playlist would be provided instead of the stream
  (due to /listen being a reserved url
- Fixed the YP connection tester causing listener add metrics requests
  to be sent
- Fixed a number of scenarios where aborting a pending source relay
  connection would not terminate correctly
- Fixed some path resolution issues where accented characters are in the
  file path
- Fixed listeners already connected to a stream before it has obtained
  information from the YP not being reported to the metrics system and
  not being applied to advert groups if applicable
- Fixed admincssfile not being re-loaded correctly on configuarion file
  reload
- Fixed random crash on accessing the log view
- Fixed random crash on closing when trying to write a log message and
  the logger has already been stopped
- Fixed error reporting if there is an issue with configuration file
  backup and edit actions
- Fixed HTTPS urls not being processed correctly causing broken urls on
  some of the server pages
- Fixed handling of 1.x sources and relays which do not provide bitrate
  information so it is now determined from the stream audio data as
  needed
- Fixed url reported when doing a YP url change not being correctly
  updated
- Fixed advert triggers not always working Ultravox and manual XML title
  updates
- Fixed AAC kbps calculations not being correct in some situations
- Fixed a number of streaming related issues if \'short sends\' are
  occurring (which primarily could lead to skips and data loss)
- Fixed Shoutcast 2.x sources reporting their received bandwidth total
  against Shoutcast 2.x relays
- Fixed some issues with the user agent management page
- Fixed trying to ban listeners by user agent with an empty user agents
  not being handled correctly
- Fixed \'http://\' being incorrectly added onto some of the 1.x style
  \'StreamUrl\' metadata values
- Fixed a number of title update verification issues which were causing
  title corruption with extended character titles (affects 2.4.x)
- Fixed the configuration file re-write option not working correctly in
  some scenarios
- Fixed reported random locking issues being seen on some setups causing
  the DNAS to appear like it has crashed but is still running and just
  in a locked state\
  \
- Updated the streampath filtering
- Updated title filtering mappings
- Updated to the latest cacert.pem
- Updated to libcurl 7.49.1
- Updated to OpenSSL 1.0.2h\
  \
- Other code cleanup, minor bug fixes, re-ordering common cases to be
  checked first, processing reductions, page cleanups and anything else
  to improve stability, useability and responsiveness of the DNAS server
- A plethora of monetization-related, stability and other general fixes

[]{#700}

### 2.4.8 Build 700

------------------------------------------------------------------------

- Added FLV containerisation support for MP3 and AAC streams (add
  ?type=.flv to compatible stream urls to use)
- Added support for sending title updates to Tunein for DNAS+ streams
- Added \'minbitrate\' and \'streamminbitrate\' options to complement
  the \'maxbitrate\' and \'streammaxbitrate\' options
- Added \'streambitrate\' alias for setting both \'streammaxbitrate\'
  and \'streamminbitrate\' to enforce a single allowed bitrate
- Added the HTML5 player to /index.html?sid=0 page for all compatible
  streams (currently only MP3 streams)
- Added \'type=x\' parameter to force specific connection handling (e.g.
  type=http or type=.flv or type=sc1 or type=sc2 or type=html)
  irrespective of what the connection may indicate from header and
  user-agent values)
- Added unlimited listener support when setting \'maxuser=0\' to allow
  any listener connection (the server will still need to be able to
  support the number of requests when this is enabled to avoid streaming
  issues)
- Added frame syncing support on all source inputs (direct and relay) to
  filter out bad stream data
- Added \'dns\' mappings of the \'ip\' config options (e.g. publicdns
  -\> publicip)
- Added modes to enable / disable only the source and only the listener
  debugging options via mode=debug?option=source and
  mode=debug?option=listener respectively
- Added StreamNext=\'xxx\' to the Shoutcast 1.x-style in-stream title
  updates (will need listener software updates to be able to make use of
  this)
- Added samplerate reporting on the appropriate stream pages and log
  output
- Added rate limiting on all listener handlers to help reduce listeners
  getting too far ahead or adverts being resumed from at the in-correct
  position (or playing the filler as well as the adverts)
- Added \'ratelimit\' to enable control of the frame rate limiting
  feature (set ratelimit=0 to disable if it causes issues)
- Added \'adtestfile\', \'adtestfileloop\', \'streamadtestfile\',
  \'streamadtestfileloop\', and related handling to aid in testing
  advert triggers will work (see documentation for details)
- Added \'adminfile\' support which allows for restricting unwanted
  access to admin.cgi to only valid IP / hostnames added intto the
  \'sc_serv.admin\' file (see documentation for details)
- Added \'forceshortsends\' support which allows for mimicking
  restricted network output which can occassionally be helpful for
  debugging
- Added \'adminnowrap\' support to allow for disabling some of the
  mobile friendly CSS / HTML changes for the stream admin page and its
  display of the listener list
- Added a sanitised configuration settings view mode for the server
  administrator to aid in checking that the DNAS is using the settings
  it is meant to be using
- Added /currentmetadata?sid=# which is a more accessible version of the
  admin.cgi mode=viewxml or mode=viewjson and page=5 requests for
  getting the extended stream metadata
- Added support to make better use of the X-Forwarded-For HTTP header
  (use usexff=0 to disable this change) which is helpful if all
  listeners appear to be connected from the local machine due to
  front-facing services
- Added proper handling of HTTP HEAD requests to resolve a number of
  issues with unexpected listener connections and failed source
  connections
- Added a \'kick duplicates\' option to the stream administrator page to
  make it easier to kick duplicate connections from the same user agent
  and address (see documentation for how to use this in a script)
- Added support for direct HTTP sources (e.g. Icecast based sources) to
  be accepted when providing MP3 and AAC based stream content)
- Added support for Shoutcast 1.x sources to be accepted on \'portbase\'
  and not \'portbase+1\' as per the Shoutcast 1.x protocol specification
  which makes it possible for all sources (1.x and 2.x) to be accepted
  on a single port instead of needing two ports (see documentation for
  details and limitations of this mode)\
  \
- Changed authhash management to improve integration with the Radionomy
  platform and services now being offered for Shoutcast broadcasters
- Changed the default CSS / HTML output to adjustements to work better
  on mobile devices / small screens including consolidating and removing
  some of the information on the summary pages
- Changed the YP update to be able to do a full re-add of the stream on
  update incase of YP-side issues on add
- Changed the YP update handling to be more dynamic to aid with remote
  clustering fixes
- Changed to use a new scheduler which allows the server to be more
  flexible and allows the rate limiting support to work correctly
- Changed to require a key press if running normally (non-daemon and
  non-service modes) when a major issue occurs of the server cannot be
  run
- Changed 1.x source handling to check the password earlier in the
  connection steps which allows for quicker checking and setup of the
  source or rejection as applicable
- Changed the the existing playing and admin metadata responses to
  include extended metadata (if available)
- Changed the tailing mode to match the 1.x DNAS so it will now only
  show the log output from when opening the tailing view
- Changed title update to clarify why certain title updates are being
  rejected
- Changed the way that advert triggers are detected and processed to
  increase the reliability of advert triggers being actioned
- Changed some of the page icons to appear more visible on dark
  backgrounds
- Changed log output to only show \'Terminating listeners\...\' if there
  are listeners
- Changed some more internal data sctructures to provide additional
  memory reductions on per-listener basis
- Changed applicable timeout handling to go through a common handler
  which now ensures that per-stream overrides on the timeouts are
  correctly applied
- Changed to indicate CDN mode on backup relay connections
- Changed the internal handling of the config items to better handle
  large stream ids so as to save memory if not using sequential
  streamids (which speeds up config handling as well as potentially
  saving a lot of memory)
- Changed to check and abort starting the DNAS if no source passwords
  are specified
- Changed some of the log start-up wording messages
- Changed the Flash Policy Server to generate the response immediately
  to reduce time to provide a response
- Changed to not check for \<policy-file-request/\> if the Flash Policy
  Server is not enabled on the port
- Changed the HTTP handler to reduce the time to process requests when
  first processing the request
- Changed to show the bitrate of the skipped files to help with
  diagnosing why a file was skipped
- Changed handling of relay and direct 1.x sources to improve
  consistency between them and reduce the time to start a relay
  connection
- Changed the 2.x relay handling to reduce time to setup the relay
  connection as well as reducing memory for the connection setup
- Changed file / advert checking to also check the samplerate to improve
  reliabity of file / advert inserts
- Changed the stream login / logout options to have \'Stream\' in front
  of them to make it clearer vs the main Server actions
- Changed to look for SSLv2 / SSLv3 / TLSv1.x connections and abort them
  as we do not support HTTPS connections and this was causing false
  source connection attempts
- Changed debugging output to make it easier to see the full filepath of
  the control files being used
- Changed when the YP \'add\' is issued to prevent it spamming the
  metrics system if the connnection quickly fails (e.g. when running a
  relay that cannot connect to the source)
- Changed Shoutcast 1.x and HTTP listener connection handling to be done
  separately which allows us to provide an optimised HTTP experience
  than the prior shared handling
- Changed the debugging options admin page to make it easier to enable
  groups of options and find other related usage changes
- Changed the help / documentation links to use a more complete page
  which better details information
- Changed the Windows version to make use of a modified pthread-win32 to
  make internal handling more consistent between OS platforms
- Changed the \'kick all\' button to span across all of \'kick\' actions
  and to respond to clicks anywhere in the element
- Changed the advert status to now be in it\'s own column instead of
  being in the \'connected duration\' column
- Changed the \'sources\' page to show the direct stream urls of the
  configured streams
- Changed error message output to be more consistent between the
  platform versions
- Changed Windows Vista+ usage to better scale for larger listener
  numbers compared to using the Windows XP and prior mode
- Changed the listener duration output to be a more condensed version
  (more like the 1.x DNAS which is better for mobile)
- Changed the ultravox creation to reduce the processing overhead when
  creating such data
- Changed admin.cgi?mode=history to provide XML and JSON responses like
  the /played(.html) method can provide
- Changed to ignore empty icy-icq, icy-irc and icy-aim headers which
  some older sources send and which could cause the source to be
  incorrectly rejected
- Changed to allow empty icy-url headers to improve legacy source
  connection support
- Changed the stream admin page to load the current listener list
  asynchronously instead of waiting for all of the details to load at
  once
- Changed the HTML5 player on the DNAS pages to force http mode
- Changed the HTML5 player on the DNAS pages to be hidden if the browser
  being used does not support such playback of the stream(s)
- Changed to use HTTPS for all communication the DNAS needs to make
- Changed to show the user agent in the banned connection log messages
- Changed to not save \'streamid\' when re-writing or editing the config
  file as the DNAS is able to work this out without needing the option
  to be present (unlike with older 2.x releases)
- Changed to about direct source connections earlier on if the source
  password is incorrect than was previously being done\
  \
- Fixed handling of XML title updates with escaped characters leading to
  unexpected title update failures
- Fixed issues with excessive CPU usage due to connections to the DNAS
  not having enough data ready to be provided or received
- Fixed unexpected CPU usage when under low or no listener load (most
  noticeable on resource limited setups)
- Fixed all reproducible memory and object leaks (mainly against the
  advert implementation)
- Fixed the wrong streampath being used if the streampath config option
  is set but is left empty
- Fixed streampath generation for the HTML5 player on the DNAS pages and
  for any listener / playlist requests (to improve listener / player
  compatibility)
- Fixed Roku playback issues (affects 2.4.x)
- Fixed Winamp 5.6+ playback issues (affects 2.4.7)
- Fixed peaklisteners not being shown when there are no active listeners
  on the server admin page
- Fixed metrics handling issues which were causing corrupted reponses to
  be sent (breaking account statistics)
- Fixed advert updates being re-tried too often and not following the
  server side update interval
- Fixed advert update pulls failing randomly after the first pull
  attempt
- Fixed advert group not being updated in all cases for the existing
  listeners
- Fixed advert groups not being displayed on the admin page in all
  situations
- Fixed no message being shown on the advert groups if there are no
  known advert groups (affects 2.4.7)
- Fixed adverts for Shoutcast 1.x listeners not always firing if no data
  could be sent
- Fixed lock-up for Shoutcast 1.x listener when providing adverts and a
  title update needs to be sent
- Fixed invalid HTTP requests attempting to be handled as a source
  connection
- Fixed advert groups not being updated on the admin page unless some
  internal checks had been made
- Fixed issue with the updater repeatedly re-downloading the update
  (2.4.3 / 2.4.7 beta issue)
- Fixed /admin.cgi?mode=viewxml and /admin.cgi?mode=viewjson requests
  without a page parameter not being allowed for requests using the
  stream source password (resolves a 1.x DNAS compatibility issue)
- Fixed configuration file writing not saving correctly with
  non-sequential stream configurations
- Fixed default \'pidfile\' generation not creating the file in the
  correct directory when run as a daemon (affects 2.4.x)
- Fixed some debug messages from showing when they should not appear in
  non-debug mode
- Fixed passwords containing the \# character being incorrectly rejected
  due to the multi-1.x source support (affects 2.4.7)
- Fixed the edit config handler not being able to create the backup
  config file on Windows (affects 2.4.x)
- Fixed the receive and send buffers not being correctly limited in all
  cases to help prevent overflow issues
- Fixed some of the supporting resource methods not providing compressed
  version of the resource as needed
- Fixed ID3v1.x tags not being correctly stripped from intro / backup /
  adtest files
- Fixed streampath allowing /listen to be used which would cause failed
  stream playback as a playlist would be provided instead of the stream
  (due to /listen being a reserved url
- Fixed the YP connection tester causing listener add metrics requests
  to be sent
- Fixed a number of scenarios where aborting a pending source relay
  connection would not terminate correctly
- Fixed some path resolution issues where accented characters are in the
  file path
- Fixed listeners already connected to a stream before it has obtained
  information from the YP not being reported to the metrics system and
  not being applied to advert groups if applicable
- Fixed admincssfile not being re-loaded correctly on configuarion file
  reload
- Fixed random crash on accessing the log view
- Fixed random crash on closing when trying to write a log message and
  the logger has already been stopped
- Fixed error reporting if there is an issue with configuration file
  backup and edit actions
- Fixed HTTPS urls not being processed correctly causing broken urls on
  some of the server pages
- Fixed handling of 1.x sources and relays which do not provide bitrate
  information so it is now determined from the stream audio data as
  needed
- Fixed url reported when doing a YP url change not being correctly
  updated
- Fixed advert triggers not always working Ultravox and manual XML title
  updates
- Fixed AAC kbps calculations not being correct in some situations
- Fixed a number of streaming related issues if \'short sends\' are
  occurring (which primarily could lead to skips and data loss)
- Fixed Shoutcast 2.x sources reporting their received bandwidth total
  against Shoutcast 2.x relays
- Fixed some issues with the user agent management page
- Fixed trying to ban listeners by user agent with an empty user agents
  not being handled correctly
- Fixed \'http://\' being incorrectly added onto some of the 1.x style
  \'StreamUrl\' metadata values
- Fixed a number of title update verification issues which were causing
  title corruption with extended character titles (affects 2.4.x)
- Fixed the configuration file re-write option not working correctly in
  some scenarios
- Fixed reported random locking issues being seen on some setups causing
  the DNAS to appear like it has crashed but is still running and just
  in a locked state\
  \
- Updated the streampath filtering
- Updated title filtering mappings
- Updated to the latest cacert.pem
- Updated to libcurl 7.47.1
- Updated to OpenSSL 1.0.2g\
  \
- Other code cleanup, minor bug fixes, re-ordering common cases to be
  checked first, processing reductions, page cleanups and anything else
  to improve stability, useability and responsiveness of the DNAS server

\

[]{#256}

### 2.4.7 Build 256

------------------------------------------------------------------------

- Added multiple 1.x source client support - see the DNAS\'s \'View
  Source Connection Details\' on the Server Summary page in the interim
  if needed for the password value to be used or
  http://wiki.winamp.com/wiki/Shoutcast_Server_Source_Support
- Added ability for listeners to be provided the \'backupfile or
  \'streambackupfile\' when no source connected (see documentation for
  usage)
- Added \'backuploop\' and \'streambackuploop\' options (default = 0 to
  keep looping) for controlling the number of consecutive backup file
  play loops
- Added \'backuptitle\' and \'streambackuptitle\' options for use with
  the no source backup file support
- Added validation of the passwords to ensure the colon character is a
  special case that is not used
- Added a server admin page to show the advert group details of the
  currently active streams as well as the status of advert pulls
- Added visual indication whether a client may play adverts and if it
  has played any adverts
- Added extra parameter checking of the banning / reserved IP actions
  (including fixing a DNAS lockup / crash due to bad data in some cases)
- Added banning a client connection by IP / DNS to also block access to
  most of the API methods from the server
- Added better debug logging of the banning / reserved client access
  control
- Added server admin page to allow for toggling the debug options on /
  off whilst the DNAS is running without the need to manually edit the
  config file
- Added options to enable / disable all of the debugging options on the
  server admin page
- Added \'streamlisted\' and \'streamlistederror\' (if applicable) to
  the stats responses for getting the stream\'s listed status
- Added automatic downloading of newer DNAS builds and related changes
  to the new version update messages
- Added auth / metrics / adverts traffic to the bandwidth tracking page
  and methods
- Added checks to prevent trying to publically list un-supported streams
  e.g. OGG Vorbis and NSV which are now marked as private
- Added the uptime indication to all of the admin pages for better
  consistency
- Added extra handling to better detect the stream bitrate from sources
  (primarily Icecast relays)
- Added clearing the cached stats / playlist responses to the
  \'clearcache\' admin method
- Added a generic html5 audio player to the bottom of the stream summary
  and admin summary pages as a quick way to check what the stream is
  playing (mp3 streams only and relies on the browser default
  implementation)
- Added caching of the public stats and other commonly accessed pages
  and resources (1 sec) and playlist (5 sec) responses from the server
  to improve response times under heavy loads
- Added \'startrelays\' and \'kicksources\' admin modes for batch
  starting configured relays and batch stopping of all connected sources
- Adding a lot of extra parameter validation based on reproduceable
  crashes and input validation failures
- Added support for additional genres on the appropriate DNAS pages, api
  responses and listener connections (how to access this will follow
  later)
- Added basic support on the Linux build to get some form of crash
  report with it creating a file like /tmp/sc_serv_segfault\_\<pid\>.log
  (where \<pid\> is the process id)
- Added better debug output for tracking transitions into and out of the
  advert plays as well as the number of successful plays
- Added a debug column when admetricsdebug=1 is set for better tracking
  of advert issues in addition to the tooltip shown in the connected
  column
- Added \'referer\' and \'x-forwarded-for\' values to the listener stats
  api responses (user request)
- Added option on the server admin summary page for manually checking
  for new versions of the DNAS
- Added the current log and conf files to the server admin summary page
  so it is easier to see what is being used
- Added extra 1.x source title UTF-8 conversions which should improve
  handling of non UTF-8 titles
- Added support to provide PSAs for listeners assigned an advert group
  but there is available advert group to play on advert triggers
- Added better checking of advert inserts and frame syncing for AAC
  based streams to improve playback
- Added better memory handling which reduces per-listener and web
  request memory usage by up to 50% (primarily via structure re-packing
  and reducing duplication)
- Added support for new YP requirements and interaction\
  \
- Changed handling of relays from other 2.x DNAS to reduce CPU usage
  when active (gives a 50% CPU reduction on the RPi build!)
- Changed when successful title updates are logged to avoid confusion if
  it subsequently fails
- Changed the public stream status page (index.html?sid=0) to show a bit
  more information about the active streams (user request)
- Changed the public status page text for YP error code 480 to make it
  clearer why a stream is not listed
- Changed the log level for bad title updates from error to warning
- Changed some of the threading error messages to be more consistent
- Changed all static images provided by the DNAS to come from
  \<server\>/images/\* for improved caching and speeds up some page
  loads
- Changed \'server\' to \'stream\' where appropriate on the public and
  admin pages for better consistency
- Changed \'admin login\' to \'stream login\' and some other related
  changes for better consistency
- Changed invalid bitrates from the source to be reported as \'unknown\'
  instead of \'0\'
- Changed the http handler hand-off to the admin.cgi handler to save
  some compute cycles (micro-optimisation)
- Changed the ordering of the http page handling to detect commonly used
  pages a bit quicker (micro-optimisation)
- Changed the ordering of the http requests and checks done to speed up
  commonly accessed pages (in-addition to caching changes)
- Changed some of the curl instances to only be created when actually
  needed and to not be done for private stream instances
- Changed the advert title display on the song history page to make it
  clearer what is sent to the clients and what the listener is sent once
  it\'s processed
- Changed the error messages when core authhash values are missing in
  the YP responses instead of showing a generic 400 error message
- Changed \'streampath\' handling to filter some inappropriate values
  seen including self-referencing addresses
- Changed the flow of things in the HTTP request handling to reduce the
  processing time of such requests
- Changed some common listener response strings to be initialised once
  instead of every time
- Changed title updates to filter out duplicate title updates where
  applicable
- Changed all url / ip config value checking to be done consistently and
  applied to all applicable cases
- Changed the Windows builds timer resolution to a preferred method
  which will not affect the system wide timer resolution (that was a bad
  thing to be doing)
- Changed the station name link to shoutcast.com to use the now
  preferred method
- Changed the \'songhistory\' default from 10 to 20 to provide an
  average of an hour\'s song history
- Changed the \'metainterval \' default from 8192 to 16384 to better
  match other broadcasting platforms
- Changed the display of the log / config files on the admin pages to
  just show the filename and not a complete / partial filepath with the
  full path as the tool tip for the items
- Changed to show the relay icon for Icecast connections on the listener
  list so all known relays are clearly visible
- Changed to cache the user-agent of the valid client connection to save
  re-querying them in other parts of the DNAS
- Changed \'stream url\' to \'website\' on the stream summary and admin
  pages
- Changed the timeout for advert pulls to resolve a number of pull
  failures
- Changed the server sources page layout and added some additional
  information and reference links
- Changed the ordering of some of the options on the server admin
  summary page
- Changed logging output to ignore some empty messages that were
  incorrectly being generated
- Changed internal handling of logging to reduce it\'s resolution which
  provides a small CPU usage reduction
- Change accessing /stats without the \'sid\' parameter to follow the
  1.x style of stream picking to ensure a valid response is provided
- Changed how some parts of the server are built to prevent data being
  modified when it should not
- Changed w3c log archive name to better distinguish from normal log
  archive naming
- Changed the /currentsong and /nextsong responses to not attempt to be
  compressed as most cases will not be smaller and wastes time to
  determine this
- Changed the Windows event log handling when running as a Windows
  service to remove superfluous information\
  \
- Fixed all reproducible memory and object leaks
- Fixed not being able to transition back to the stream on source
  re-connect if a listener is being provided the backup file
- Fixed crash on close (and possibly during running) when trying to
  clean-up source and client connections (race-condition)
- Fixed rare crash on close if processing some of the web requests just
  after start-up
- Fixed crash if the listener client could not be created
- Fixed a number of stability and memory allocation issues under high
  connection loads (a lot of work for a single changelog entry!)
- Fixed banning issues which allowed some clients still to connect
  despite being in the ban list
- Fixed some rare relay starting failures when using a forced
  configuration reload
- Fixed minor issues with the HTML of the admin pages
- Fixed double-pumping of some title updates via
  \'admin.cgi?sid=#&mode=updinfo\' (mainly affected XML updates)
- Fixed the refresh page timer showing the DNAS uptime in some instances
- Fixed a wrong message being provided for some failed SC2 source
  connections
- Fixed empty title updates not being allowed (introduced in the last
  build
- Fixed some web requests not being restarted correctly in some cases
- Fixed a number of crashes on closing due to some in-progress web
  requests not being aborted when needed or under high connection loads
  at the time of closing
- Fixed a number of issues if there are issues within libcurl creating
  connections which could lead to unexpected lockups
- Fixed redirection failures on invalid ban / reserved list / user-agent
  admin pages due to poor input data
- Fixed loop-back addresses being added to the invalid ban / reserved
  list when already treated as a special case
- Fixed possible issue with relay failure handling
- Fixed wrong name being stored in the w3c log archive
- Fixed anything obvious found from re-checking the source code via
  valgrind, cppcheck and manual checking
- Fixed playback skipping issues with WMP due to variations in handling
  between Windows 7 and Windows 8.x and newer with ICY vs HTTP instances
- Fixed reserved IP handling not working correctly due to checking the
  wrong value in some cases
- Fixed to make sure we do not miss the YP maximum update interval
- Fixed loading of local files to make use of the relative path fixes
  (remnent of issues present in 2.4.1 / 2.4.2)
- Fixed generation of the \'host\' header value on relay connections to
  include the port and clean up the address as per RFC specifications
- Fixed crash when processing the empty lines after a \"HTTP/1.1 100
  Continue\" header
- Fixed ID3v1.x tag removal not working correctly on intro and backup
  file cleanup
- Fixed adverts not being triggered reliably when using a 2.x based
  source
- Fixed adverts not being triggered correctly when running as a private
  stream in any of the cdn modes
- Fixed all other reported advert related handling issues
- Fixed handling of some externally sent admin.cgi requests incorrectly
  getting a redirect response
- Fixed \'songhistory\' not being updated on a configuration reload
- Fixed failures to transition into an advert with a 1.x listener client
  (e.g. format mis-match) then blocking later advert transitions
- Fixed YP connections from being processed via the auth handling
- Fixed title updates via \'admin.cgi?sid=#&mode=updinfo\' not always
  working or not being providing the expected HTTP response (affected
  some LiquidSoap uses)
- Fixed our OpenSSL and libcurl instances to be built correctly for SNI
  (Server Name Indication)
- Fixed the wrong log file being shown and reported as being used if the
  DNAS has to use it\'s fallback handling to try to ensure a log file
  will be generated
- Fixed display issues of long intro and backup filepaths in the admin
  pages\
  \
- Updated icons for recognised clients as well as setting a warning icon
  for some likely stream rippers on the listeners list
- Updated the YP maintenance code and message reporting
- Updated to the latest cacert.pem
- Updated to OpenSSL 1.0.2a
- Updated to libcurl 7.41.0\
  \
- Removed the experimental \'streamportlegacy\' option as this is no
  longer needed now with the multi-1.x source support that was added
- Removed the state_GetStreamData debug output for SC1 sources
- Removed incorrect header message on the debug options page
- Removed \"Connection:close\" for some of the admin page actions header
  response to speed up some page loads
- Removed the Windows builds dependency on the supporting dlls in the
  Microsoft.VC90.CRT folder
- Removed \'autoauthhash\' functionality due to coming authhash
  management changes
- Removed the authhash removal action due to coming authhash management
  changes
- Removed \'email\' functionality due to coming authhash management
  changes
- Removed SSLv2 and SSLv3 support in our OpenSSL and libcurl instances
- Removed direct use of gethostbyname(..)
- Removed AIM, IRC and ICQ support from the web pages and api responses
  (they have not been supported by the YP for a number of years)\
  \
- Other code cleanup, minor bug fixes, page cleanups and anything else
  to improve stability, useability and responsiveness of the server

\

[]{#167}

### 2.4.2 Build 167 / 168

------------------------------------------------------------------------

- Fixed issues with not finding cacert.pem in the same location as the
  DNAS program file which was preventing YP connectivity working (2.4.1
  build 164 specific)
- Fixed broken relative config file handling not working correctly with
  init scripts and 3rd party control panels (2.4.1 build 165 specific)\
  \
- Changed some of the log and admin page output to better show the
  actual filepath being used for log and configuration files (helpful
  for determining path loading issues)
- Changed handling incase the cacert.pem file cannot be found to be more
  forgiving for the time being (futher changes will follow in later
  builds)\
  \
- Removed \'Error writing to console\' log messages when **screenlog=1**
  (default) and the shell the DNAS was started in is closed whilst the
  DNAS is still running e.g. due to OS defined timeouts - always use
  **screenlog=0** if running the DNAS and you do not need it sending log
  output to the console

\

[]{#165}

### 2.4.1 Build 164 / 165

------------------------------------------------------------------------

- Added features relating to the \'DNAS+ for CDN\' streaming solution\
  \
- Added ability to preserve the peak listener numbers for a stream
  between DNAS sessions e.g. when updating the DNAS (subject to
  conditions) - this requires the stream being publically listed and
  will be disabled if found to be abused!
- Added [experimental]{.underline} support to allow streams using 1.x
  source clients to be able to provide stream branding artwork via
  \'artworkfile\' and \'streamartworkfile\' configuration options (this
  enables basic stream branding artwork support for legacy 1.x based
  streams subject to client support \[as below\] - for 2.x based
  streams, the source should already have the ability to provide the
  stream branding and now playing artwork)
- Added ability to provide artwork to 1.x clients via the legacy
  in-stream metadata system when provided from a 2.x source or when
  using the experimental support mentioned above (subject to clients
  supporting this feature - see the wiki for more information)
- Added \'email\' configuration option so hosts can provide a generic
  contact address (which is used during authhash creation / updates if
  not manually specified)\
  \
- Changed YP connections to use HTTPS - this means a valid cacert.pem
  [must]{.underline} be present in the same folder as the DNAS program
  file otherwise the DNAS cannot list streams
- Changed file permission defaults on non-Windows builds to be more
  consistent between the different APIs internally used for files
  created by the DNAS
- Changed the update notifications to provide extra information where
  possible about the update\
  \
- Fixed YP connectivity issues introduced during the change over to
  using libcurl in the 2.2.2 / 2.4 releases e.g. randomly stops updating
  or prevents the DNAS from being able to close correctly or does not
  correctly handle cases when the YP is not contactable
- Fixed handling of custom streampaths with parameters (starting with /;
  or ;) always providing stream #1 (using /stream/x/ did not experience
  this issue)
- Fixed rare issue leading to high CPU usage when using a single core
  non-Windows system
- Fixed rare crash when accessing some of the admin pages on non-Windows
  builds
- Fixed some IP formatting issues on the admin pages\
  \
- Removed remaining ICY support so all client connections are now via
  standard HTTP requets as 2.4 did (ICY was a HTTP-like protocol)
- Removed the \'disableicy\' configuration option for controlling this
  support (not needed due to the prior change)\
  \
- Updated to support newer YP requirements for authhash handling and
  listing modes as well as related tweaks to the authhash management
  pages
- Updated to OpenSSL v1.0.1j\
  \
- Return of the BSD 8.x build\
  \
- Other miscellaneous code changes, improvments and related
  documentation updates (including handling immediate segfaults on
  start-up)

\

[]{#147}

### 2.4.0 Build 147

------------------------------------------------------------------------

- Added support for the Radionomy advert and metrics platforms so you
  can earn money from overlaying some adverts on the stream and / or
  leveraging the online broadcasting tools from Radionomy (this is an
  opt-in feature and requires a Radionomy account - it does not prevent
  you using the DNAS like before)\
  \
- Added \'publicip\' to be used to specify a DNS / IP value to use for
  what the YP will see as your server address when \'destip\' is used
  for binding against a non-public value e.g. anything in the loopback
  address range (see documentation for usage)
- Added \'alternateports\' which can be used to allow for client only
  connections on port(s) other than \'portbase\' e.g. to deal with
  firewalls blocking client access on some networks
- Added \'disableicy\' to the options handled by the configuration
  reload action
- Added \'rotateinterval\' to allow for changing the time between
  automatic log rotations (default is 24 hours) and can be set to 0 to
  disable log rotation completely
- Added basic command-line help into the DNAS itself (use /? or \--help)
  which is based on the OS version being used without the need to
  consult the main documentation
- Added better handling of the intro and backup files to ensure they
  match the stream format and will now reject files which do not match
  the bitrate\
  \
- Changed \'disableicy=1\' handling (default behaviour since 2.2.2) to
  allow 1.x clients which explicitly request in-stream metadata to still
  receive it e.g. VLC and foobar2000\
  \
- Fixed crash when rotating the log and w3c files (this was mainly seen
  under Centova Cast installs) and some other log file handling
  refinements
- Fixed authhash issues specific to the 2.2.2 release (mainly seen as a
  462 error code when trying to use the management actions)
- Fixed handling of unrecognised loopback addresses causing incorrect
  addresses in some of the DNAS responses e.g. the listen.\* methods
- Fixed MP3 intro files breaking stream playback (such as causing
  stuttering or just not playing anything else) when transitioning to
  the actual audio stream e.g. most Flash based players (this is an
  issue going all the way back to the v1.x DNAS!)
- Fixed MP3 streams not starting on a full audio frame (this should
  improve client compatibility, more so with Flash based players)
- Fixed the \'Block User Agent\' column on the stream admin page not
  showing the correct action (it could be shown in the \'Reserve
  Client\' in some cases)
- Fixed repeated admin login prompt when trying to manage an authhash in
  some cases (mainly if having per-stream admin passwords)\
  \
- Removed specific handling for the deprecated AOL shoutcast.com site /
  embeddable Flash player (that specific player is no longer officially
  supported hence removing support for it)\
  \
- Other miscellaneous code changes, improvments and related
  documentation updates

\

[]{#123}

### 2.2.2 Build 123

------------------------------------------------------------------------

- The first Radionomy provided Shoutcast DNAS release after the sale of
  Shoutcast (and Winamp) in January 2014
- This is primarily a maintenance release to resolve issues and
  broadcaster requests with the 2.2.x DNAS since the last build provided
  under AOL ownership\
  \
- Added \'pidfile\' option to control the creation of the file
  containing the process id of the DNAS (this defaults to creating
  \'sc_serv\_\<portbase\>.pid if not specified in the same folder as the
  DNAS)
- Added ability to block user agents from connecting to the streams on a
  global and per-stream basis if required (via admin pages and admin api
  methods)
- Added \'agentfile\', \'streamagentfile\' and \'saveagentlistonexit\'
  configuration options to allow for where and how the sc_serv.agent
  file is stored (which is used for holding the blocked user agents)
- Added \'blockemptyuseragent\' configuration option to allow for
  preventing client connections without a user agent from connecting
  (note: some valid clients e.g. some hardware devices may not provide a
  user agent and enabling this may incorrectly block legitimate client
  connections)
- Added \'Reload Banned List(s)\' option to the server admin page to
  complement the \'Reload Reserved List(s)\' option\
  \
- Changed network handling on non-Windows builds to try to resolve the
  random crashes with large listener numbers and scale better (e.g.
  going over \~330 concurrent listeners)
- Changed to use libcurl instead of a custom library for all YP requests
  to help resolve the YP connection reliability issues some users have
  seen with most of the 2.x releases
- Changed \'disableicy\' default from \'0\' to \'1\' so we now by
  default provide HTTP instead of ICY headers - this resolves all known
  HTML5 audio playback access issues
- Changed the frequency and formatting of some of the log output
- Changed \'unique\' to also apply to the \'portbase\' config option
- Changed log file creation to use sc_serv\_\<pid\>.log (where \<pid\>
  is the process id of the DNAS) if the default / fallback
  \'sc_serv.log\' cannot be created e.g. due to file permissions
  creating / accessing an existing copy of the file (mainly affects
  non-Windows builds)
- Changed \'maxuser\' default from 32 to 512 listeners (you will need to
  ensure the OS can support this e.g. adjusting ulimit -n on non-Windows
  installs)
- Changed \'relayreconnecttime\' default from 30 to 5 seconds (based on
  usage feedback)
- Changed \'adaptivebuffersize\' default from 5 to 10 seconds (based on
  usage feedback)
- Changed GCC version used to build the Linux / Raspberry Pi versions
  (now using GCC 4.7.2 instead of GCC 4.4.6 / 4.6.3 respectively)
- Changed title update handling in respect to issues related to
  CVE-2014-4166 (which we were not informed about before it was
  disclosed!)\
  \
- Fixed stream access issues (always providing stream #1) if
  streampath=/stream is set and providing multiple streams from the same
  DNAS
- Fixed formatting error in the JSON version of the listener details
  (XML version was not affected)
- Fixed some file handle leaks with log file handling (mainly happened
  when compressing older log files on rotation)
- Fixed a number of YP error handling issues (mainly found from changing
  over to use libcurl) e.g. stuck on \'Processing\...\' when an error
  was logged
- Fixed the \'city\' value of the authhash not being correctly re-loaded
  when viewing the authhash\
  \
- Other miscellaneous code changes, improvments and related
  documentation updates

\

[]{#109}

### 2.2.1 Build 109 [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Completed remaining 1.x compatibility improvements (specifically
  relating to YP availability issues so clients are now only blocked
  from connecting if there is no source connected)\
  \
- Added experimental \'streamportlegacy\' option to allow for supporting
  more than one direct legacy 1.x source connection to the server (see
  documentation for usage / limitations)\
  \
- Changed Windows service install / uninstall messages when UAC
  elevation / admin access is required to undertake the action\
  \
- Fixed issues due to a bug in the handling of the \'useicy\' option
  which is now deprecated and replaced by the \'disableicy\' option (see
  documentation for usage)
- Fixed reported issues with the \'Source Login Details\' page (mainly
  showing mode availability incorrectly)
- Fixed missing \'UID\' value for client disconnects in the main log
  output
- Fixed some clients being incorrectly shown as \'HTML5\' client types
  when they were not on the admin pages
- Fixed compile issues preventing the BSD build from being built for the
  prior release\
  \
- Other miscellaneous code changes, improvments and related
  documentation updates

\

[]{#107}

### 2.2.0 Build 107 [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Added a \'setup\' mode which allows basic configuration of the server
  when run without a configuration file (see documentation for usage)
- Added a \'builder\' mode which allows for the configuration builder to
  be run within the server (broadcasting is disabled in this mode)
- Added automatic authhash generation when a stream source is connected
  on a public stream and an authhash was not already present (can be
  disabled using autoauthhash=0)
- Added /statistics which consolidates all of the /stats?sid=# results
  for all known and active streams
- Added \'flashpolicyserverport\' allowing the DNAS to serve up the
  Flash policy file (as per \'flashpolicyfile\') on port 843 or a custom
  port (as well as on \'portbase\')
- Added serving of \'shoutcast.swf\' for custom flash players to be
  handled in the same domain as the server (see documentation for usage)
- Added listen.xspf and listen.qtl to the /listen\* playlist options
  available (so now pls, m3u, asx, qtl and xspf are available on a
  stream)
- Added \'portlegacy\' to allow changing or disabling the port legacy
  1.x sources connect on (see documentation for usage)
- Added \'publicport\' to allow changing the port reported to the YP
  servers and any clients using the /listen.\* playlists where
  \'portbase\' is not the port externally seen
- Added option on \'Server Summary\' page (accessed from
  admin.cgi?sid=0) to allow for manually setting the stream authhash
  e.g. if needed for a relay
- Added \'Stream DJ\' (if known) on the stream admin pages as well as
  \<DJ/\> in all statistics for getting the current DJ of the connected
  source (more formal specification than fiddling the IRC / AIM / ICQ
  values as used with 1.x DNAS setups)
- Added \'streammaxbitrate\' and \'maxbitrate\' options for per-stream
  or global limiting of the source bitrate allowed for a connection
- Added \'streambackupurl\' option for per-stream fallback if the
  original source (direct or via a relay) fails to keep the stream alive
  (see documentation for usage)
- Added server bandwidth usage reporting for the server administrator
  via the admin.cgi?mode=bandwidth action (see documentation for usage)
- Added JSON and JSON-P responses to the /stats?sid=# and /statistics
  responses by appending &json=1 for JSON and appending
  &callback=\<function\> for JSON-P
- Added XML, JSON and JSON-P support to the /played response as well as
  to support &pass to allow song history access to the XML, JSON and
  JSON-P responses even when public display of them is disabled
- Added admin.cgi?mode=viewjson as a JSON and JSON-P equivalent of
  admin.cgi?mode=viewxml (see documentation for usage)
- Added ability to kick all connected clients on a stream via the stream
  admin summary page in addition to the existing single client kicking
- Added \'redirecturl\', \'streamredirecturl\' and \'streamhidestats\'
  options for per-stream or global redirection / blocking of publically
  accessible pages when \'hidestats\' or the new \'streamhidestats\'
  options are enabled
- Added SIGUSR1 and SIGUSR2 support in non-Windows builds for reloading
  the configuration file from the console (see documentation for usage)
- Added SIGWINCH support in non-Windows builds for reloading the
  Reserved IP file(s) from the console (see documentation for usage)
- Added support for GZIP (RFC 1952) encoding of appropriate page and
  data responses if supported by the requesting connection and will
  provide a bandwidth saving
- Added a \'View Source Login Details\' page to the server summary page
  to make it easier to get the login details required for all
  appropriate stream configurations
- Added sp=\<streampath\> support to all web methods which support
  sid=\<streamid\> to be able to access a page by streampath instead of
  streamid - streamid is still the preferred method (see documentation
  for usage)
- Added \'admin.cgi?mode=viewlog&viewlog=save\' method to allow for
  downloading the server log output as a GZIP compressed archive (useful
  for checking the log output remotely or for support issues)
- Added \'streammovedurl\' option for per-stream redirection of
  permanently stopped or moved streams from the server
- Added archiving of log, w3c and streamw3c files when rotating these
  files would cause them to be deleted (which happens when there are
  usually five rotated copies already)
- Added \'logrotates\' and \'logbackup\' options to provide finer
  control over the rotation (default of 5 files) and backup (default
  off) of the log files during rotations
- Added icy=http parameter detection on 1.x client connections to return
  a HTTP instead of a ICY header response type e.g.
  server:port/?icy=http
- Added \'url\' parameter to the \'updinfo\' action to replicate 1.x
  DNAS functionality which had not been re-implemented in the 2.x DNAS
- Added \'dj\' parameter to the \'updinfo\' action to allow for scripted
  updating of the \'DJ\' reported for a stream (useful for legacy source
  software)
- Added \'ypstatus\' method for the server administrator via the
  admin.cgi?mode=ypstatus action (see documentation for usage)
- Added reporting of the stationid for public listings on the server and
  stream administrator pages
- Added \'streamuptime\' to the /stats and /statistic responses to aid
  in monitoring of the length of source connections to the server
- Added /streamart?sid=# and /playingart?sid=# methods as a public
  version of the verions viewable via \'admin.cgi?mode=art&sid=#\'
- Added back /7(.html) support due to issues in getting legacy reporting
  tools updated to support the recommended \'stats\' methods
- Added admin.cgi?mode=history as an admin page equivalent of
  played.html?sid=# so stream administrators can easily see the played
  history of the stream
- Added \'useicy\' option to control if the DNAS will provide ICY
  (default) or HTTP (HTML5 compatible) headers for client connections\
  \
- Improved YP interaction when the IP address of the DNAS changes whilst
  it is still broadcasting (requires YP update for this to work fully)
- Improved handling of source relay connections especially via the
  server\'s admin pages e.g. a pending source relay connection can be
  aborted
- Improved handling with large client numbers to reduce CPU usage as
  well as not crashing when exhausting the imposed maximum file
  descriptors (e.g. ulimit -n)\
  \
- Changed \'streampath\' to default to / for streamid=1 to improve
  compatibility (/stream/\<sid\>/ is still default on all other streams)
- Changed config file handling to automatically use \'sc_serv.ini\' or
  \'sc_serv.conf\' if present if no config file is specified (better
  replicates 1.x DNAS behaviour)
- Changed relayconnectretries to accept zero (relayconnectretries=0) to
  keep trying to reconnect to the relay source and changed the default
  to 0 from 3
- Changed reporting of the YP connection state on the admin pages to
  make it clearer if the authhash is invalid or empty
- Changed the \'Stream Configurations\' xml response to fill
  \<STREAMAUTHHASH/\> with EMPTY or INVALID on error as applicable
- Changed YP2 connection attempts to not be made if the authhash is
  determined to be invalid or empty
- Changed \'hidestats\' to allow for more control over the pages which
  are able to be disabled (see documentation for usage)
- Changed \'updinfo\' to not need \'type=xml\' as it now auto-detects
  how to process the title information received
- Changed \'configrewrite\' to accept \'configrewrite=2\' so now
  \'configrewrite=1\' generates minimal configurations (only saves
  values not at the default) and \'configrewrite=2\' outputs all
  configuration options (like \'configrewrite=1\' used to do)
- Changed YP2 handling to show the stream number, outputting of detailed
  error messages (where provided) and not output /yp/resp/updatefreq
  errors
- Changed handling of the Shoutcast site player client connections to
  not send in-stream metadata to workaround issues with title changes
- Changed song history and current song titles shown in any reports to
  use the pre-formatted title from the source if available (does not
  change titles in clients)
- Changed handling of introfile to attempt to strip any tags from the
  raw file to improve client compatibility
- Changed client listener reports (via the stream administrator page and
  xml reports) to now be sorted oldest to newest
- Changed w3c log handling to output header information to improve tool
  compatibility (replicates 1.x DNAS behaviour)
- Changed handling of \'streamid\' so if not specified then a stream
  configuration will be created if any appropriate stream\* options are
  read on loading
- Changed Shoutcast 2 source logging to only output complete metadata
  and connection details when using uvox2sourcedebug=1 (instead of
  always as before)
- Changed all /listen\* playlist options to output the \'backupserver\'
  provided by the YP where possible
- Changed some of the server and stream admin page header links to
  better hide invalid options and to make navigation easier, etc
- Changed the configuration reload option (\'admin.cgi?mode=reload\' on
  the \'Server Summary\' page) to also update the debugging options and
  other options (see documentation for additions)
- Changed Reserved IP handling to allow connections from 127.0.0.1
  through even if not specified (allows access to admin pages)
- Changed the Ban and Reserve IP administration actions to save changes
  (if enabled) at the time instead of only on exit
- Changed YP2 stream registration to wait until the source has provided
  a title to allow the station listing to appear sooner (requires YP
  update for this to work fully)
- Changed handling of authhash changes via the update option to update
  the current stream information without requiring the stream(s) to be
  restarted
- Changed server summary page to count inactive relay configurations (if
  correctly specified) as available streams so it is possible to restart
  them easier
- Changed the user agent (mainly for relay connections) to now be
  \'Ultravox/2.1 Shoutcast Server x.x.x.x\' (where x.x.x.x is the
  version and build numbers)
- Changed the stream admin page to also report the type (1.x or 2.x) of
  the connected clients
- Changed the current listener list on the admin summary page
  (admin.cgi?sid=#) to group client connections from the same IP address
  (make non-unique connections easier to find)
- Changed all /listen.\* handling to use the public IP of the DNAS as
  reported by the YP when publically listed (requires YP update for this
  to work fully)
- Changed \'flashpolicyfile\' handling to use an internal copy if a
  custom file is not specified (which has the benefit of specifying the
  actual ports used)
- Changed console output to highlight errors in red, warnings in yellow
  and debug output in green to make them more obvious (cannot be
  disabled)
- Changed the \'view logfile\' administration pages to highlight errors,
  warnings and debug output to make them more obvious (colours can be
  changed via css)
- Changed /stats?sid=# to support &pass to allow stats access even when
  public display of them is disabled
- Changed Windows builds to only send warning and error messages to the
  event log in service mode or if a critical error happens on startup
  before file logging occurs
- Changed autodumpsourcetime and streamautodumpsourcetime to be known as
  autodumptime and streamautodumptime respectively to better reflect the
  general usage of these options
- Changed server summary page to display configured but non-running
  configurations along with active sources and inactive relay
  configurations
- Changed \'yptimeout\' default from 60 to 30 seconds
- Changed \'Shoutcast Metadata Puller\' handling to only return the
  title update (if enabled) instead of the audio data to help save
  bandwidth on popular listed streams
- Changed GCC version used to build the Linux versions (now using GCC
  4.4.6 instead of GCC 4.1.2 from CentOS 5.8)
- Changed \'admin.cgi?sid=#&mode=kickdst\' to support IP address(s) in
  addition to the existing unique client id(s) support\
  \
- Removed Ultravox 2.0 (old Aol Radio) client and source support
  (reduces memory and cpu usage - amount depends on the setup used)
- Removed \'yp2\' configuration option and the ability to run the DNAS
  in YP1 mode\
  \
- Fixed all reported issues with the authhash management system since it
  was first released for public use
- Fixed random crashes due to incomplete / dodgy client requests made to
  the server (resolved from user reports)
- Fixed destip not being followed for YP connections so binding to a
  different IP or using a DNS name should now work (requires YP update
  for this to fully work)
- Fixed some rare issues with binding to a custom destip failing when it
  should have worked
- Fixed updating of \'streampath\' not causing a YP details refresh
  (remove then add) on any changed stream configurations
- Fixed crash on Windows versions after choosing a config file to use
  when run without write permissions to create \'logfile\' when no
  config file is specified
- Fixed crash on non-Windows versions when processing invalid xml
  metadata from sources
- Fixed some attempts to create / update authhashes not working due to
  url-encoding issues with the data passed on to the YP
- Fixed handling of clearly invalid authhashes to not show the update
  and remove admin options
- Fixed handling of \'unique\' causing the DNAS to lockup on loading in
  some scenarios
- Fixed some relative path issues when using \'include\' in some
  scenarios
- Fixed 1.x sources not able to connect if icy-name / icy-url are empty
  even if titleformat / urlformat have been specified
- Fixed stream url on the summary pages not providing valid links in
  some scenarios
- Fixed MAXLISTENERS on /stats?sid=# reporting maxuser instead of
  streammaxuser when no source is connected
- Fixed UID in the Listener Stats being output in the wrong number
  format
- Fixed the \'Unique Listeners\' total on the administrator summary page
  not always reporting the correct number
- Fixed the Shoutcast Directory metadata puller / tester client
  statistics filtering due to related YP changes
- Fixed accessing the root summary page with the Opera browser to not
  start streaming like a client connection
- Fixed /currentsong?sid=# not returning a title if present when
  songhistory or streamhistory is zero
- Fixed titles not appearing in the Shoutcast Directory listings when
  using a 1.x source in some scenarios
- Fixed some 1.x sources (e.g. butt) not being able to connect in some
  cases due to non-standard icy\* headers received
- Fixed the windows w3c log file outputting additional linebreaks which
  were not required
- Fixed some Winamp v5.5x clients being incorrectly sent a 2.x instead
  of a 1.x Shoutcast stream (resolves missing stream titles)
- Fixed loading issues related to not being able to create the logfile
  and force reverts to default path
- Fixed OS path conversion on config file entries not always working
  e.g. when moving a windows config to linux
- Fixed relays not running if http:// was not specified (is now
  automatically appended internally)
- Fixed additional issues relating to relay connection errors including
  not following the retry timeouts in all scenarios or not attempting to
  reconnect in specific scenarios
- Fixed the next song being incorrectly reported at times or not being
  correctly cleared as applicable
- Fixed enabling \'riponly=1\' blocking access to the admin pages of the
  DNAS plus it now allowa connections from 127.0.0.1 / localhost through
  even if not added to the list (for local monitoring)
- Fixed Banned and Reserved IP checks not always working (better
  validates against per-stream and global lists now)
- Fixed handling of user agents with invalid control characters causing
  log / reporting issues
- Fixed issues with \'admin.cgi?mode=reload\' attempting to keep
  updating values which were already updated or incorrectly removing
  additional stream configurations when only 1 needed removing
- Fixed accessing a stream using \'streampath\' not working correctly in
  all cases e.g. when no / was prefixed for the entry in the
  configuration file
- Fixed current song display issues with some 1.x based relays where
  non-english characters are present and were not correctly handled as
  utf-8
- Fixed issues with multiple connection attempts generated for an
  already pending relay connection via the configuration reload or
  \'startrelay\' method or when a relay is removed but was pending
- Fixed issues with Windows service and non-Windows daemon use primarily
  when no configuration file is specified (see documentation for amended
  usage)
- Fixed more clients than is specified for (stream)maxusers if only
  reserved clients are allowed to connect to the server (will reject
  reserved clients if no one can be kicked to free a slot)
- Fixed listen.pls generation for NSV streams generating incomplete
  playlists (all other playlist formats were generated correctly)
- Fixed out of order metadata packets being incorrectly handled if
  another metadata packet of a different type is received whilst waiting
  on an existing type (mainly affected in-stream artwork)
- Fixed checking for configuration files not always working on
  non-Windows versions or incorrectly reporting a directory as a valid
  file
- Fixed \'w3clog\' and \'streamw3clog\' not always being rotated when
  using SIGHUP or when the main log file is auto-rotated or on starting
  the server
- Fixed DNS lookup issue on non-Windows builds which could prevent
  access to the Shoutcast servers
- Fixed crash when getting repeated connection attempts and no source is
  connected in rare cases
- Fixed some invalid characters being kept from song title updates which
  could cause some of the XML responses being invalid
- Fixed title updates from some 1.x based sources not being accepted
  when allowed by a 1.x based DNAS server previously
- Fixed some DNAS provided web page access failing in specific OS and
  machine configurations\
  \
- Upgraded libraries to use expat-2.1.0\
  \
- Other miscellaneous code changes, de-duplication of error messages,
  cleanup of normal running log messages, admin page tweaks and
  minimisations, improvments and related documentation updates

\

[]{#29}

### 2.0.0 Build 29 [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Changed Shoutcast 2 client header to show the DNAS\'s actual version
  instead of just \'Shoutcast 2.0\'\
  \
- Fixed Shoutcast 2 compatible clients only allowed to connect as a
  Shoutcast 1 client (build 27 / 28 specific)
- Fixed more config files being shown than allowed on non-Windows
  versions when no configuration file specified

\

[]{#28}

### 2.0.0 Build 28 (RC 2) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Added listen.asx to the /listen\* playlist options available (so now
  pls, m3u and asx are available on a stream)
- Added detection of sc_serv.ini if no configuration file was passed on
  loading (detects 1.x configuration files)
- Added \'type=xml\' parameter to the \'updinfo\' action to allow for
  2.x style XML metadata titles to be manually done\
  \
- Changed \'streampath\' handling to allow \'/\' to be used again (was
  disabled in build 27)\
  \
- Fixed kicking of listeners failing to respond / taking multiple
  attempts to react\
  \
- Other miscellaneous code changes, improvments and related
  documentation updates

\

[]{#27}

### 2.0.0 Build 27 (RC 1) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Added ability to create, update and remove authhashes via the
  administrator summary page (accessed from admin.cgi?sid=0)
- Added reporting of per-stream and total server listener counts on
  admin.cgi or admin.cgi?sid=0
- Added \'streamw3clog\' option for per-stream logging with fallback to
  \'w3clog\' if not specified
- Added \'faviconfile\' and \'faviconmimetype\' to allow for a local
  icon / image file to be served as the favicon.ico for the server
  webpages
- Added \'robotstxtfile\' to allow for a local robots.txt to be served
  as the robots.txt for the server
- Added supporting features for in-stream artwork (related to March 2011
  protocol changes) with online verions viewable via
  \'admin.cgi?mode=art&sid=#\' for admins to check (see documentation
  for usage)
- Added /stats?sid=# to allow easier access to the stream information
  (this mirrors admin.cgi?sid=#mode=viewxml&page=1) and is the effective
  replacement of 7.html
- Added \'hidestats\' to allow disabling of the new /stats?sid=# mode
  (see documentation for usage)
- Added \'admin.cgi?mode=rotate\' and SIGHUP support to rotate
  \'logfile\', \'w3clog\' and \'streamw3clog\' whilst sc_serv is running
  (see documentation for usage)
- Added ability to restart a kicked relay source via the administration
  pages
- Added \'relayconnectretries\' to control how many times a relay
  attempts to reconnect to the specified source before it is failed
- Added a 5 second refresh delay when \'admin.cgi?mode=reload\' is used
  and results in changes to source connections / relays unlikely to be
  displayed immediately
- Added back clickable link support for IRC stream entries on the
  administration pages only if the IRC stream entry begins with irc://
- Added UNIQUELISTENERS to admin.cgi?mode=viewxml to complement
  REPORTEDLISTENERS (as the server status pages display)
- Added STREAMPATH to admin.cgi?mode=viewxml for pages 0, 1 and 6 to
  show the \'streampath\' of the specified stream configuration
  otherwise will output /stream/\<sid\>/\
  \
- Changed the ban action for connected clients on the administation
  pages to also kick the client connection used for the ban action
- Changed accessing stream and root urls (i.e. http://ip:port or
  http://ip:port/stream/1) in a browser to show the html pages
  (index.html) instead of providing the stream (replicates 1.x DNAS
  behaviour)
- Changed the /listen\* handling to improve auto-filling of the server
  IP in the generated playlist files
- Changed the /listen\* handling to attempt to provide a title much like
  the YP generated playlist files instead of just an address
- Changed the delimiter in file paths read from the configuration file
  to be converted to the correct format for the OS being used
- Changed the admin.cgi?mode=viewxml action to return a slimmer xml
  response compared to prior builds (to save more bandwidth)
- Changed the rotate action to reset the 1 day delay until the next
  automatic rotation if a rotate is manually run
- Changed how the Shoutcast Directory metadata puller / tester is
  handled in client statistics to no longer skew listener totals
- Changed how the version of the DNAS is reported to make it more like
  the 1.x DNAS as well as fixing it not being reported in some error
  response\
  \
- Removed REPORTEDLISTENERS from admin.cgi?mode=viewxml for pages 0 and
  1 as it duplicated the CURRENTLISTENERS entry
- Removed POINTER from admin.cgi?mode=viewxml for page 3 as it
  duplicated the UID entry
- Removed direct support for specifying \'relayport\' and
  \'relayserver\' (though if found then they are mapped to
  streamrelayurl against streamid=1 and will be removed if using
  configrewrite=1)\
  \
- Fixed \'autodumpsourcetime\' and \'streamautodumpsourcetime\' not
  being applied correctly especially if either were set to 0
- Fixed usage of \'streampath\' in the listen playlists generated to
  ensure the formed playlist entry will work where possible for client
  connections
- Fixed connection issues with YP directory listings when no
  \'streampath\' is specifed (now ensures /stream/\<sid\>/ is set as the
  path so connections will be made against the correct stream)
- Fixed some client connection issues when \'streampath\' has been
  specifed (could lead to sid=1 being played even if the streampath_2
  was attempted)
- Fixed non-english title compatibility with 1.x sources i.e. titles
  with accented characters, was leading to title issues (also affected
  legacy DNAS builds)
- Fixed some specific stream configuration issues with not all values
  being correctly mapped to the expected stream configuration
- Fixed \'admin.cgi?mode=viewlog\' to escape the log file contents
  correctly so appears correctly in the html output
- Fixed issues with \'admin.cgi?mode=reload\' where it could cause a
  lockup (non-Windows versions), caused incorrect removal of a
  configuration groups, source password changes not always applied,
  relays not being updated or started in all cases
- Fixed logfile not being correctly set if no config file is passed but
  a selection is then made from the list shown
- Fixed kicking and banning not working in some cases
- Fixed issues handling invalid stream id values on source counnection
  attempts
- Fixed crash when attempting to use configuration groups where
  \'streamrelayurl\' contains an url
- Fixed incorrect loading of some 1.x DNAS boolean based configiruation
  options
- Fixed \'allowrelay=0\' from preventing connection attempts to be made
  to the YP directory when there is no relay
- Fixed crash when changing a stream\'s authhash and then doing a
  configuration reload
- Fixed \'include\' not working with some relative file paths e.g.
  include=sc_serv_debug.conf when include=.\\sc_serv_debug.conf worked
- Fixed listen.m3u not always providing a valid stream url especially
  when using \'streampath\'
- Fixed \'configrewrite\' to no longer write some old / invalid
  configuration options when enabled\
  \
- Other miscellaneous code changes, crash fixes, improvments and related
  documentation updates

\

[]{#19}

### 2.0.0 Build 19 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Changed password handling to not allow \'password\' to be the same as
  \'adminpassword\' with relevant checks on the per-stream passwords
- Changed Ultavox 2.0 Winamp clients (typically prior to v5.60x) to
  receive a 1.x Shoutcast stream instead of an Ultravox 2 stream to
  resolve missing stream titles
- Changed some of the reported details in the http headers used for
  Shoutcast 2 (Ultravox 2.1) streams
- Changed the stream admin page to also report the user agent of the
  connected clients\
  \
- Fixed some more issues with password handling related to the changes
  in builds 17 and 18

\

[]{#18}

### 2.0.0 Build 18 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Added prompt for configuration file to load if one is not specified or
  there is an error loading the configuration file in non-daemon /
  service mode\
  \
- Fixed some admin options not working due to password related changes
  in the previous release e.g. prevented legacy client title updates
- Fixed loading issues on non-Windows versions related to the handling
  of the banned and reserved IP files

\

[]{#17}

### 2.0.0 Build 17 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Added per stream versions of the following configuration options
  (prefix with \'stream\' to use them in addition to the master options
  e.g. streampassword): password, adminpassword, publicserver,
  allowrelay, allowpublicrelay, riponly, autodumpsourcetime,
  autodumpusers, listenertime, songhistory, uvoxcipherkey, introfile,
  backupfile, banfile, ripfile
- Added \'logclients\' configuration option to allow for client
  connections and disconnects to not be logged (default behaviour is to
  log these events)
- Added summary administration page accessed via admin.cgi or
  admin.cgi?sid=0 instead of going to the default stream summary page
  (only works with \'adminpassword\' access)
- Added \'&iponly=1\' support to \'admin.cgi?mode=viewxml\' so listener
  stats (in standard mode or when using &page=3) will only output the
  listener\'s IP address instead of all other information\
  \
- Changed \'admin.cgi?mode=reload\' to only be available via the new
  summary administration page instead of on each stream administration
  page
- Changed the /currentsong and \<songtitle\> values to be a formatted
  title as \'artist - title\' if the 2.x stream source metadata allows
  instead of just showing \'title\'
- Changed the /listen\* actions to auto-fill the server IP in the
  generated playlist files if \'dstip / destip\' is not set so the
  playlist is more likely to be valid
- Changed the /home action to open the stream url in a new window / tab
  instead or replacing the current view of the admin pages
- Changed the server to not load if appropriate passwords have not been
  specified (including per stream configurations) to improve security
  especially with per-stream password support
- Changed the title produced for 1.x clients to be \'artist - title\'
  instead of \'artist - album - title\' to resolve some legacy client
  related issues
- Changed some of the admin page text spacing and other misc html
  changes
- Changed administration pages to not allow access to the \'tail
  logfile\' and \'view logfile\' pages when using
  \'streamadminpassword\' to prevent information from other stream
  configuration groups being seen\
  \
- Fixed the Ban and Reserve IP administration actions to not re-add an
  already banned or reserved IP (overlap of single vs subnets still
  happens)
- Fixed stream configuration options not being applied correctly when
  using the plain name (without \_X on the end) for streamid=1
  configurations
- Fixed /stream/sid client access not working correctly if an invalid
  station id (sid) was passed on the connection attempt
- Fixed the root index.html page occassionally reporting streams as
  available when they are not
- Fixed \'admin.cgi?mode=reload&sid=#\' not always updating or removing
  stream configurations correctly despite reporting it had especially
  with streamid=1 changes or the source password changed
- Fixed YP2 connections not following the \'yptimeout\' configuration
  option
- Fixed \'admin.cgi?sid=#&mode=updinfo\' only updating the default
  stream configuration instead of the stream configuration required\
  \
- Removed invalid link for the IRC stream entry on the administration
  pages\
  \
- Updated Configuration Builder to latest version
- Updated documentation to reflect new options and related errata

\

[]{#14}

### 2.0.0 Build 14 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Improved handling of the mimetype reported by legacy mp3 sources to
  improve usage of 1.x sources (maps more mimetypes to audio/mpeg as
  applicable)\
  \
- Added /nextsongs?sid=# to show the next coming songs in an xml form
  (if known) when using a compatible 2.x stream source
- Added \'admincssfile\' option to allow for using 1.x DNAS / Shoutcast
  2 / custom css styling of the index.html and the admin pages (check
  documentation for usage)\
  \
- Changed \'admin.cgi?mode=reload&sid=#\' to also update \'password\'
  and \'requirestreamconfigs\'
- Changed \'configrewrite=1\' to not output \'include\' on exit\
  \
- Fixed Windows version logfile path generation if none or an invalid
  configuration file is passed (relates to change of default logfile
  path to %temp%\\sc_serv.log in previous build)
- Fixed Windows service not running and being identified as sc_trans in
  the system event logs\
  \
- Updated some of the example configurations to resolve issues with
  platform specific path handling
- Updated Configuration Builder to latest version

\

[]{#13}

### 2.0.0 Build 13 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Added \'streammaxuser\' to the stream configuration group options to
  allow for a per stream limit with \'maxuser\' still ensuring a maximum
  client limit on the server
- Added support for wildcards via the \'include\' feature e.g.
  \'include=stream/\*.conf\' to allow for a specific file for each
  stream configuration on the server
- Added a new \'admin.cgi?mode=reload&sid=#\' mode to the administration
  support which will make the server reload its stream configurations by
  adding / removing / updating any streams on the fly where it can
  (unless \'&force=1\' is also passed) otherwise it will kick sources
  and clients as applicable
- Added YP connection status on the \'Server Status\' message on
  index.html and the admin page to make it easier to see if a YP
  connection on a public server exists
- Added more information to the log generated to indicate if a YP
  connection has worked or not without having to enable debugging in the
  configuration file or completely cryptic messages
- Added &page=5 additional param handling to the admin.cgi?mode=viewxml
  stats action to provide the currently held metadata of the playing
  song (amount of information depends on the source and what metadata it
  provides)
- Added &page=6 additional param handling to the admin.cgi?mode=viewxml
  stats action to provide the currently known stream configurations
  (amount of information depends on the number of stream configurations
  specified)
- Added Configuration Builder (see config_builder folder) as a graphical
  way of making working configuration files (in combination with forum
  user thinktink)\
  \
- Now ships in linux 64-bit - is identified as \'posix(linux x64)\' with
  the 32-bit version now identified as \'posix(linux x86)\'\
  \
- Changed YP2 connection failures to be reported more clearly instead of
  an obscure /yp/resp/updatefreq missing error or requiring
  \'yp2debug=1\' to be enabled
- Changed default location of the log file on Windows installs to
  %temp%\\sc_serv.log instead of c:\\sc_serv.log (resolves some issues
  on Windows Vista / 7 and write permissions)
- Changed pvt_update(..) to not spam the logs when \'yp2debug=1\' is
  enabled in the configuration file if a connection attempt to the YP2
  fails
- Changed http header checks to allow empty values from a \'key:value\'
  pair to resolve some client connection issues
- Changed the \'Server Status\' message on the index.html and the admin
  pages to show \'There is no source connected or no stream is
  configured for stream #X\' when the stream is not active or there is
  no source connected
- Changed the reported configuration file on the index.html and the
  admin pages to be the base file loaded instead of the last included
  file if \'include\' is used in the configuration files
- Changed handling of 1.x sources to autofill the aim, irc and icq
  entries with N/A or 0 as appropriate if not set in what the source
  sends to the server e.g. Nicecast on Mac\
  \
- Fixed an api dependency issue preventing this from running on Windows
  2000
- Fixed /nextsong?sid=# to show the unescaped version of the \<soon/\>
  metadata tag if received from the source
- Fixed clients trying to connect via Ultravox 2.0 (e.g. Winamp 5.5x and
  older versions) not being able to connect or causing non-Windows
  versions of the server to terminate incorrectly
- Fixed logging not working when passing certain invalid configuration
  files
- Fixed admin.cgi?mode=resetxml not working - now will reset
  \<peaklisteners\> and \<streamhits\> fields to mimick 1.x DNAS
  handling\
  \
- Disabled the \<webdata/\> block in the admin.cgi?mode=viewxml stats
  (as well as via the &page=2 additional param) for the time being
- Disabled some of the admin.cgi?mode=viewxml stats entries not
  currently being filled in just to cut down on unnecessary bandwidth
  usage - better use the &page=# option to get specific sets of stats
  instead of all in one go to keep bandwidth usage down\
  \
- Updated documentation based on user feedback and related changes,
  added sc_serv_simple.conf as an ultra simple configuration example,
  minor other issues & changes made

\

[]{#10}

### 2.0.0 Build 10 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- Now ships in BSD 8.x and Windows 64-bit\
  \
- Added \'next song\' to the stream + admin pages
- Added a disconnect message indicating the duration, number of bytes
  sent and agent of the connection being closed
- Added a current and next song pages (/currentsong?sid=# and
  /nextsong?sid=#) along with \<NEXTSONG\> in the xml report for
  consistency
- Added description for the Win32 service so it\'s clearer the service
  is ours\
  \
- Accessing any admin / info pages with no stream id or the stream id is
  less than or equal to zero will show a summary of any available
  streams (if there are any)
- Fully enabled Shoutcast 2 (Ultravox 2.1) protocol support with server
  output (used with YP2=1 in config and a compatible connecting client)\
  \
- Changed \'yp2\' configuration setting default to \'on\'
- Changed config handling to close sc_serv if not set or missing /
  invalid\
  \
- Fixed locale issues preventing sc_serv from loading without changing
  the machine\'s locale (non-Win32 issue)
- Minor log message changes to sort of standardise the message style
- Fixed segfault issue when attempting to connect to YP2 (may have been
  an internal thing, not sure)
- On Windows versions \'ctrl + break\' is now handled as a valid quit
  command instead of just having the running instance closed\
  \
- Upgraded libraries to use expat-2.0.1

\

[]{#7}

### 2.0.0 Build 7 (Beta) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

- First public release of the 2.x DNAS

\
