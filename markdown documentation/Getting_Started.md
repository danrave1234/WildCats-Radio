::: header
# Shoutcast Getting Started Guide {#shoutcast-getting-started-guide align="center"}

(Last Updated 08 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
|   - [1.1 What is Shoutcast?](#What_is_Shoutcast?)                     |
|   - [1.2 Windows Users](#Windows_Users)                               |
|   - [1.3 Windows Vista and Newer                                      |
|     Specifics](#Windows_Vista_and_Newer_Specifics)                    |
| - [2 What is Required?](#What_is_Required?)                           |
|   - [2.1 Supported Operating Systems](#Supported_Operating_Systems)   |
| - [3 Getting Installed](#Getting_Installed)                           |
|   - [3.1 Download the Correct Version](#Download_the_Correct_Version) |
|   - [3.2 Choose an Install Location](#Choose_an_Install_Location)     |
|   - [3.3 Installation](#Installation)                                 |
|   - [3.4 Setting Up The Tools](#Setting_Up_The_Tools)                 |
|   - [3.5 DNAS Server](#DNAS_Server)                                   |
|     - [3.5.1 Configuration Setup](#DNAS_Server_Configuration_Setup)   |
|       - [3.5.1.1 Upgrading an Existing                                |
|         Install](#Upgrading_an_Existing_Install)                      |
|       - [3.5.1.2 Example Configurations](#Example_Configurations)     |
|     - [3.5.2 Starting the DNAS Server](#Starting_the_DNAS_Server)     |
|     - [3.5.3 Errors Running the DNAS                                  |
|       Server](#Errors_Running_the_DNAS_Server)                        |
|     - [3.5.4 Obtaining an Authhash](#Obtaining_an_Authhash)           |
|   - [3.6 Source DSP](#Source_DSP)                                     |
|     - [3.6.1 Installing the Source DSP](#Installing_the_Source_DSP)   |
|     - [3.6.2 Starting the Source DSP](#Starting_the_Source_DSP)       |
|     - [3.6.3 Configuring the Source DSP](#Configuring_the_Source_DSP) |
|   - [3.7 Completion](#Completion)                                     |
| - [4 Further Information](#Further_Information)                       |
|   - [4.1 Related Documentation](#Related_Documentation)               |
| - [5 Glossary](#Glossary)                                             |
+-----------------------------------------------------------------------+

[]{#Introduction}

## 1. Introduction

------------------------------------------------------------------------

The aim of this document is to help guide you through the process of
getting a Shoutcast 2 system installed and broadcasting so people can
connect to it through the Shoutcast Radio Directory and hear the great
content you have and want to provide to the world.

It is assumed you know how to setup your network to allow your DNAS
server to be visible when broadcasting on the internet (if required)
which includes any router(s) and port(s).

This guide will refer you to appropriate places in the documentation
provided with the tools. These referenced sections provide more detailed
information on the option or feature such as what would need to be set
in the Source DSP to allow it to work with the DNAS server being setup.

\

[]{#What_is_Shoutcast?}

## 1.1. What is Shoutcast? [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

If you are new to Shoutcast then this is probably something you may have
already asked or you are trying to find out.

\
At its most basic, the Shoutcast system is based around a \'client +
server\' configuration which allows you to run a DNAS server (either
directly or via a hosted service) which can then provide stream(s) of
the \'source\' connected to the server to any listeners connected to the
DNAS server.

\
So a simple Shoutcast setup would consist of the following:

![Simple Shoutcast
System](res/Simple.png){style="width:328px;padding-left:30px;"}

\
This is not the only way to setup a Shoutcast system and more examples
can be seen in the shoutcast_system_overview.txt which goes into more
detail about the way Shoutcast works as well as other ways of setting up
a Shoutcast system (see [section 2.0](#What_is_Required?)).

\

[]{#Windows_Users}

## 1.2. Windows Users [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The DNAS server is built to be run from the command-line console (or as
a native service if using this mode) which may appear to be daunting
when most interaction done with the operating system is done via a
graphical interface (GUI).

If you are not acquainted with using the command-line console then you
will need to find a guide which shows you the basics of using the
command-line console along with getting you familiar with using it
before trying to get any of the Shoutcast tools running. If you search
for \'how to use the command prompt\' then you should find a guide which
you can follow to help get you knowledgeable enough with using the
command-line console.

This may appear to be a step backwards if you previously used the 1.x
DNAS server with its very basic GUI wrapper which otherwise was acting
in the same manner as the command-line console just without the look of
the operating system. However the 1.x DNAS server was at its core a
command-line tool just like the 2.x DNAS server is now.

In most cases you will just need to double-click a file to get the DNAS
server running. For more advanced functionality it is assumed you have a
basic knowledge of how to use the command-line console for the platform
you decide to install the tools on i.e. how to run and control a program
via the command-line console including being able to pass commands and
the sending of signals as is appropriate to the platform.

\

[]{#Windows_Vista_and_Newer_Specifics}

## 1.3. Windows Vista and Newer Specifics [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Due to the UAC feature
([http://en.wikipedia.org/wiki/User_Account_Control](http://en.wikipedia.org/wiki/User_Account_Control){target="_blank"})
of these OSes you will need to remember the effect that this will have
on editing and saving of files.

By default the Windows versions of the installer will choose the native
\'Program Files\' folder (**\***) but unless you have disabled UAC or do
not have full access to the folder then you will find attempts to save
and edit any configuration files will not work.

If this is an issue then you should either choose a different folder of
all of the files or change where the tools are trying to save files and
also to save any changes in your configuration files with a text editor
which is running with administrator permissions.

This is an unfortunate inconvenience though for making it easier to
known where all of the configuration examples and documentation can be
found is better. Finally there is no reason not to choose a different
folder when installing the tools if you experience this.

\
(**\***) This will be slightly different depending on if you are using
the 32-bit or 64-bit version of the OS as well as the language of the
OS. As well the installer will pick the native \'Program Files\' folder
so installing the 32-bit version on the 64-bit OS will use \'Program
Files (x86)\' whereas installing the 64-bit version on the same OS will
use \'Program Files\'.

\

[]{#What_is_Required?}

## 2. What is Required? [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

To make your Shoutcast system you will need the following software tools
and hardware:

- A computer (real or virtual) running a supported operating system (see
  [section 2.1](#Supported_Operating_Systems))
- Shoutcast DNAS server
- An input source (e.g. Winamp plus Source DSP plug-in or any 3rd party
  source which is Shoutcast compatible)
- Media or DJ\'s or a Capture device i.e. the content you want to
  provide to people

\

[]{#Supported_Operating_Systems}

## 2.1. Supported Operating Systems [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

There are versions of the DNAS server available on the following
operating systems:

**Windows 32-bit**    From Windows 2000 and up, including server
versions\
**Windows 64-bit**    All 64-bit versions of Windows, including server
versions\
\
**Linux 32-bit**    Should generally work on most Linux distributions\
**Linux 64-bit**    and is mainly tested on CentOS 5.x and Debian\
\
**Raspbian (Raspberry Pi)**\
\
**BSD 8.x**    For newer versions of BSD you may need to install a
compatibility layer\
\
**Mac OS X (Intel versions only)**\

\
Remember to download the version of the tools which apply to the
operating system you will be installing the tools onto e.g. you could
install the 32-bit Windows version on Windows 7 64-bit but could not
install the 64-bit Windows version on Windows XP 32-bit.

If using machines with different operating systems for different tasks
then there should not be any problems with them working together e.g.
Windows for the source and Linux for the DNAS server. This is because
the tools use the same communication style irrespective of the platform
they are being run on. If you do find an incompatibility then please
report it.

\

[]{#Getting_Installed}

## 3. Getting Installed [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When following the steps listed, follow the steps which are applicable
to the operating system and the tool you are attempting to install. If
you want to install more than one thing then it is better to work
through the guide for one tool at a time especially when you are new to
Shoutcast instead of trying to do everything all at once and it failing
/ getting confused.

    It is recommended to setup the DNAS server first before attempting to setup sources.

\

[]{#Download_the_Correct_Version}

## 3.1. Download the Correct Version [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

To begin with you will need to download the correct version for the
operating system you are setting up your Shoutcast system on. See see
[section 2.1](#Supported_Operating_Systems) for clarification of the
supported operating systems. The current versions of the Shoutcast tools
can be obtained from:

[http://www.shoutcast.com/BroadcastNow](http://www.shoutcast.com/BroadcastNow){target="_blank"}\
or\
[http://forums.shoutcast.com/showthread.php?t=324877](http://forums.shoutcast.com/showthread.php?t=324877){target="_blank"}
(**\***)

\
Remember you will need to download a DNAS server (sc_serv) and a source
for the DNAS server which if using Windows then you can use the Winamp
Source DSP plug-in (dsp_sc) (which may work on non-Windows systems using
WINE but is not guaranteed and no support is offered with such a setup).

\
There are a number of third party tools (free and paid for) which can be
used as a source for a DNAS server. These are not covered as part of
this guide and if you decide you want to use one of these programs then
you will need to consult their help for getting it to work with the DNAS
server. In all cases, you will need a DNAS server correctly setup.

\
(**\***) This is a summary page and contains links to the latest
versions of the tools such as when a new release has just been released
or is being tested before it is provided via the main Shoutcast site
download page at http://www.shoutcast.com/BroadcastNow

\

[]{#Choose_an_Install_Location}

## 3.2. Choose an Install Location [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Choose an install location for the tool you want to install (be it the
DNAS server or the Source DSP plug-in for Winamp) as needed for the
Shoutcast setup you are making on the machine.

\
On Windows this choice is handled via the installer which attempts to
select a sensible new location or it will re-uses the previous install
location if doing an upgrade of a 2.x based install previously made.
This can be changed if needed during install and will need to be done if
you are running on a Windows version with UAC enabled ([section
1.3](#Windows_Vista_and_Newer_Specifics)).

\
On non-Windows operating systems you can choose any location for the
extracted location of the files as long as you have the correct
permission and access for the folder chosen.

\

[]{#Installation}

## 3.3. Installation [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

On Windows you now need to run the installer, using the folder you have
decided on along with ensuring the option to install the documentation
has been checked. Doing this will install the documentation and all
related files which are referenced in the later stages of this guide.

    If using Windows Vista or newer, ensure you install into a location which
    allows you to create / edit files preferably without having to respond to a
    UAC access prompt. See section 1.3 for more information about doing this.

\
On non-Windows you now need to extract all of the contents of the
archives you have downloaded into the install location decided on.

\

[]{#Setting_Up_The_Tools}

## 3.4. Setting Up The Tools [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The following sections are grouped together for what needs to be done in
configuring and getting ready to start one or more of the officially
provided tools. If you are not using one or more of them then you can
skip the section as appropriate. Remember that you will need to have a
valid source for use with the DNAS in order to have a listenable stream.

\

    It is important to ensure the DNAS server is properly configured. This can be
    one you are setting up or an existing or hosted DNAS Servers as unless one
    is running it will prevent any sources being used from being setup correctly.

\

[]{#DNAS_Server}

## 3.5. DNAS Server [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

[]{#DNAS_Server_Configuration_Setup}

## 3.5.1. Configuration Setup [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

To get the DNAS server running for the first time you will need to run
the \'**setup**\' mode by running **setup.bat** (Windows) or
**setup.sh** (non-Windows). This will start the DNAS server and open the
setup page in the system\'s default browser and follow the instructions
on the information which is requested.

If you do not have a default system browser or are running this in a
shell, follow the instructions shown by the DNAS server from the open
command-line / shell window.

\
By following the \'setup mode\' instructions, you will be prompted for
common settings needed to run the DNAS server e.g. passwords. Once
completed, the configuration settings will be saved as **sc_serv.conf**
in the same folder as the DNAS server program file (assuming there were
no issues. If thre is an issue then you will be notified and may need to
resolve the issue or manually save the configuration file yourself.

\
Once this is complete, you will then be able to exit \'setup mode\' or
continue running the DNAS server with the saved settings where it will
then be in a state where it is ready to accept a stream source.

\

[]{#Upgrading_an_Existing_Install}

## 3.5.1.1. Upgrading an Existing Install [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

If you are upgrading the DNAS server from an earlier version, installing
into the same folder or just replacing the **sc_serv\[.exe\]** program
file and **[cacert.pem](http://curl.haxx.se/ca/cacert.pem)** file is all
that needs to be done. It is a good idea to also install the
documentation for the new version so you have an appropriate local copy
to refer to as needed.\
\
This can be done for upgrading an existing 1.x or 2.x based DNAS server
installation.

\
If upgrading the DNAS server but are doing it on a different machine (as
part of a migration) and / or location from where it was previously, if
you already have a working configuration file then it can be copied over
to the new location and you need to ensure it is named **sc_serv.conf**
or **sc_serv.ini** as this will allow the DNAS server to automatically
use it when started. Additionally if moving the configuration file,
check that any paths referenced in the file are ok and exist with
appropriate access for how you are running the DNAS server.

\

[]{#Example_Configurations}

## 3.5.1.2. Example Configurations [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

There are some example configuration files which can be found in the
examples folder for the following scenarios if the setup mode is not
appropriate for your needs or you would like to get a better idea of
what a working configuration file can look like:

sc_serv_simple - shows how to get a simple single-stream setup working\
sc_serv_basic - shows how to get a more multi-stream setup working\
sc_serv_public - shows how to make a public server from sc_serv_basic\
sc_serv_relay - shows how to relay another source

There is more information about these example configurations in [DNAS
Server - section 8](DNAS_Server.html#Example_Configurations) and these
are provided for those not happy with the \'setup mode\' or prefer to do
things manually for specific configurations of the DNAS server.

\

[]{#Starting_the_DNAS_Server}

## 3.5.2. Starting the Server [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    If the DNAS server was not stopped after running the 'setup mode' then
    this step is only needed when you next decide to start the DNAS server.

\

::: serv
[![Setup Mode
Running](res/Console_Windows.png){.serv}](res/Console_Windows.png "DNAS Server Started on Windows")
:::

To start the DNAS server assuming the config file is either
**sc_serv.conf** or **sc_serv.ini**, you just need to run the
**sc_serv\[.exe\]** program file according to the operating system used:

Windows  -  **sc_serv.exe** or **start.bat**\
Non-Windows  -  **./sc_serv** or **./start.sh**

\
This will load the DNAS server with the details entered during setup
([section 3.5.1](#DNAS_Server_Configuration_Setup)) or from an existing
configuration when upgrading from an earlier version ([section
3.5.1.1](#Upgrading_an_Existing_Install)).

::: serv
[![Setup Mode
Running](res/Console_Linux.png){.serv}](res/Console_Linux.png "DNAS Server Started on Linux")
:::

\
To start the DNAS server with a specific configurartion file, enter the
correct command string for the operating system you are using like the
following where **\<conf\>** is the name of the configuration file in
the same directory as the DNAS server program file:

Windows  -  **sc_serv.exe \<conf\>** (in the command-line) or drag and
drop **\<conf\>** onto **sc_serv.exe**\
Non-Window  -  **./sc_serv \<conf\>**

\
You can alternatively edit **start.bat** or **start.sh** (as applicable)
and append **\<conf\>** to the end of the line and then run
**start.bat** or **./start.sh** directly. If the **\<conf\>** file
cannot be found, the DNAS server will attempt to provide an appropriate
file to use and will prompt you to select one if possible before failing
and aborting running.

\
For more information on running the DNAS server see [DNAS
Server](DNAS_Server.html) and the relevant section for the operating
system you are using:

**Windows**  -  [3.2.3](DNAS_Server.html#Run_in_the_Console) (or
[3.2](DNAS_Server.html#Windows) for more advanced options)\
**Linux / Raspbian**  -  [3.3.3](DNAS_Server.html#Run_as_a_Non-Daemon)
(or [3.3](DNAS_Server.html#Linux_/_Mac_OS_X_/_BSD) for more advanced
options)

\
Those sections also detail how to run the DNAS server in service mode
(Windows) or as a daemon (non-Windows) which allows the DNAS server to
keep running in the background without keeping a command-line or shell
window open.

\

[]{#Errors_Running_the_DNAS_Server}

## 3.5.3. Errors Running the DNAS Server [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    Skip this section if you do not experience errors when trying to run the DNAS server.

\

::: serv
[![Setup Mode
Running](res/Console_Error.png){.serv}](res/Console_Error.png "Setup Mode Running")
:::

If an issue is reported in the DNAS server\'s logs then you will see
lines with an appropriate type e.g. \'**ERROR**\' or \'**WARN**\' as
well as seeing them shown with a different colour (if looking at the
command-line / shell window) where it will use red for errors and yellow
/ orange for warning messages.

\
Error messages need to be resolved and in most cases will relate to the
DNAS server not being able to be listed in the Directory or due to a
networking related issue. Depending on the type of error, the DNAS
server may continue to run or it will close e.g. if there are no
configuration files which can be found.

\
If the error message(s) still do not make sense then either double-check
[DNAS Server - section 4.15](DNAS_Server.html#YP_Server_Errors) or goto
the Shoutcast support forums
[forums.shoutcast.com/forumdisplay.php?f=140](http://forums.shoutcast.com/forumdisplay.php?f=140)
and post your question / issue along with a copy of the log output
including the error message. Remember that the more information you can
provide to start with will make it easier for anyone else to help and
give you a solution.

\

[]{#Obtaining_an_Authhash}

## 3.5.4. Obtaining an Authhash [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    This is needed if you want the Stream to be listed in the Directory. If not make
    sure you have specified the DNAS server to be private or do so in the source.

\

::: thumb
[![Server Summary
Page](res/Start.png){.thumb}](res/Start.png "Server Summary Page")
:::

With the DNAS server running, you will need to create the authhash for
the stream(s) you want to have listed in the Directory. This is done via
the \'**Server Summary**\' page.

This works best when a source has been connected to the DNAS server,
though you can still create one for any streams which have been
configured but do not currently have a source connected. See
[**here**](DNAS_Server_Authhash_Management.html#Creating) for how to
create an authhash.

You can also find additonal information on how to [manually
edit](DNAS_Server_Authhash_Management.html#Manual_Editing) an authhash
such as when re-using an existing one to setup a server group or if
setting up a different bitrate of an existing stream.

\

[]{#Source_DSP}

## 3.6. Source DSP [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

[]{#Installing_the_Source_DSP}

## 3.6.1. Installing the Source DSP [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    Skip this if you are not setting up the Source DSP plug-in in Winamp.

\
If you want to provide a stream and are going to use Winamp and the
Source DSP then you just need to make sure to install the Source DSP
plug-in using its installer and check the option to set it as the
default DSP plug-in in Winamp.

\

[]{#Starting_the_Source_DSP}

## 3.6.2. Starting the Source DSP [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb_about
[![Select Source DSP in Winamp\'s
Preferences](res/Select_Source_DSP_in_Winamp.png){.about}](res/Select_Source_DSP_in_Winamp.png "Select Source DSP in Winamp's Preferences")
:::

Using the Source DSP plug-in requires the plug-in to be set as the
current DSP plug-in which is done by going to \'**Winamp Preferences**
-\> **Plug-ins** -\> **DSP/Effect**\' and selecting \'**Shoutcast Source
DSP \<version\>**\' (**\***) from the list of plug-ins shown.

When this entry is selected then the plug-in\'s configuration window
will be opened and from there the plug-in will be in a state where a
connection can be started via the \'**Connect**\' button on the
\'**Output**\' tab once all of the login details have been entered.

(**\***) The string \<version\> would be the actual version of the
plug-in which is installed.

\

[]{#Configuring_the_Source_DSP}

## 3.6.3. Configuring the Source DSP [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb_dsp
[![Shoutcast Source Output Tab showing password configuration
error](res/Output_tag_configuration_error.png){.thumb_dsp}](res/Output_tag_configuration_error.png "Shoutcast Source Output Tab showing password configuration error")
:::

Once the Source DSP has been installed, you will need to enter the login
details needed for it to be able to connect to the DNAS server. The
Source DSP should highlight values which need to be entered which can be
obtained from the appropriate configuration files.

To get the Source DSP connected to the DNAS server, [Source DSP Plug-in
Configuration
Examples](http://wiki.shoutcast.com/wiki/Source_DSP_Plug-in_Configuration_Examples)
shows where and what values in their configuration files are needed for
the Source DSP.

\

[]{#Completion}

## 3.7. Completion [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

You should now be up and running with a working Shoutcast system. Happy
broadcasting!

If things are still not running then go back over the section(s)
relating to the tool(s) you are having issues with and make sure that
you have followed things otherwise please see the next section
([4.0](#Further_Information)) on what you can do to get help in trying
to resolve issues.

\

[]{#Further_Information}

## 4. Further Information [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

If you have followed the setup steps detailed in [section
3](#Getting_Installed) and are still having issues with getting the
tools running or working together to achieve a certain result then first
make sure you have the currently supported version of the tool(s) in
case it is a bug in the tool(s) which has already been fixed. You can
check this via the links referenced in [section
3.1](#Download_the_Correct_Version) and especially the forum link of the
most current versions available.

\
If installing the latest version does not help or if you already are
using the latest version of the tool(s) or if the feature is not
available then please goto the Shoutcast support forums:
<http://forums.shoutcast.com/forumdisplay.php?f=140>

\
Make sure if you are reporting issues to provide as much information as
possible for the Shoutcast users who use the tools including the
following information:

- Your Shoutcast setup including all versions of the tools being used
- The issue you are experiencing
- The steps needed to reproduce the issue
- Anything else useful especially if you have been tinkering with
  options before the issue appeared

\
Remember when you post an issue that providing as much information in a
clear and concise manner will make it easier for anyone who can help to
be able to understand the issue you have. This is important as not
everyone visiting the forum are native English speakers.

\

[]{#Related_Documentation}

## 4.1. Related Documentation [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Documentation can be found online -
[wiki.shoutcast.com/wiki/SHOUTcast_Broadcaster](http://wiki.shoutcast.com/wiki/SHOUTcast_Broadcaster)
though this may not relate to the version which has been installed and
it is generally recommended to check the documentation installed with
the tool(s) installed as they will relate to that version (which can be
found in the \'docs\' folder).

Please remember that with the Shoutcast tools being designed to work on
both the Windows and non-Windows operating systems, there is information
included in the documentation which can relate to either of these
platforms. So when reading through the documentation, only follow the
information which relates to the operating system you are using.

\

[]{#Glossary}

## 5. Glossary [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

***Client*** - This is a program run which will connect to the server
e.g. Winamp.

***DNAS*** - This is an abbreviation of Distributed Network Audio Server
and refers to the way Shoutcast systems are intended in providing a
Stream to multiple Clients.

***Directory*** - This is a shortening of \'Shoutcast Radio Directory\'
and is the site where if you have a public Stream where you will then be
able to find your Stream.

***Server*** - This is the program which is run on a machine to provide
to Clients the Stream.

***Source*** - This is a program or an input device e.g. the line-in
connection on the server which is providing the data for the Stream.

***Stream*** - This is the data which is provided from the server to the
connected Client and is best thought of like the flow of water in a
stream in how it goes from the server (up stream) to the Client (down
stream).

***YP*** - This is an abbreviation of YellowPages and refers to the
Shoutcast Radio Directory listing which makes it easier for Clients to
search for and then find your Stream.

***dsp_sc*** - This is the name the Shoutcast Source DSP plug-in is
otherwise known as.

***sc_serv*** or ***sc_serv2*** - This is the name the Shoutcast DNAS
server is otherwise known as.
